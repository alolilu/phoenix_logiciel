// app/api/chantiers/[id]/pdf/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const COMPANY = {
  name: "Phoenix Nouvelle-Aquitaine",
  subtitle: "Fiche chantier",
  tagline: "Renaître proprement, c’est possible !",
};

const LOGO_PUBLIC_URL = "/phoenix-logo.png";

/** ============ helpers ============ */
function isoDateFR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// Sert uniquement pour le logo (dans /public)
function fileUrlToPublicAbsPath(fileUrl: string) {
  const rel = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
  return path.join(process.cwd(), "public", rel);
}
async function loadBytesFromPublic(fileUrl: string): Promise<Uint8Array> {
  const abs = fileUrlToPublicAbsPath(fileUrl);
  const buf = await readFile(abs);
  return new Uint8Array(buf);
}

// Petit timeout pour éviter un PDF bloqué si un blob ne répond pas
async function fetchWithTimeout(url: string, ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// Charge une image depuis une URL (Vercel Blob public)
async function loadBytesFromUrl(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const ab = await res.arrayBuffer();
  return { bytes: new Uint8Array(ab), contentType };
}

function normalizeMime(t: string) {
  const ct = (t || "").toLowerCase().split(";")[0].trim();
  if (ct === "image/jpg") return "image/jpeg";
  return ct;
}

function winAnsiSafe(s: string) {
  return (s ?? "")
    .replaceAll("→", "->")
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("…", "...")
    .replaceAll("•", "-");
}
function clampText(s: string, maxLen: number) {
  const t = winAnsiSafe(s);
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}
function wrapText(font: any, text: string, size: number, maxWidth: number) {
  const safe = winAnsiSafe(text || "");
  if (!safe.trim()) return [];
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    const wWidth = font.widthOfTextAtSize(test, size);
    if (wWidth > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** ======= bloc client dans notes ======= */
type ClientInfo = { nom: string; tel: string; email: string; adresse: string };

function extractClientBlock(notesRaw: string): { client: ClientInfo; restNotes: string } {
  const raw = String(notesRaw || "");
  const start = raw.indexOf("[[CLIENT]]");
  const end = raw.indexOf("[[/CLIENT]]");

  const empty: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };

  if (start === -1 || end === -1 || end <= start) {
    return { client: empty, restNotes: raw.trim() || "-" };
  }

  const block = raw.slice(start + "[[CLIENT]]".length, end).trim();
  const rest = (raw.slice(0, start) + raw.slice(end + "[[/CLIENT]]".length)).trim();

  const client: ClientInfo = { ...empty };
  for (const line of block.split(/\r?\n/)) {
    const [k, ...vv] = line.split("=");
    const key = (k || "").trim().toLowerCase();
    const val = vv.join("=").trim();
    if (!val) continue;
    if (key === "nom") client.nom = val;
    if (key === "tel" || key === "telephone") client.tel = val;
    if (key === "email" || key === "mail") client.email = val;
    if (key === "adresse" || key === "address") client.adresse = val;
  }

  return { client, restNotes: rest || "-" };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await ctx.params;

    const job = await prisma.jobItem.findUnique({
      where: { id },
      include: {
        staffLinks: { include: { staff: true } },
        attachments: { where: { kind: "PHOTO" }, orderBy: { uploadedAt: "desc" } },
      },
    });

    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const startISO = toISODateUTC(new Date(job.startAt));
    const endISO = toISODateUTC(new Date(job.endAt));

    const intervenants = (job.staffLinks || [])
      .map((l) => `${l.staff?.firstName ?? ""} ${l.staff?.lastName ?? ""}`.trim())
      .filter((s): s is string => Boolean(s));

    const photos = (job.attachments || [])
      .map((a) => ({
        url: a.fileUrl ?? "",
        type: normalizeMime((a as any).fileType ?? ""), // ⚠️ si fileType pas en DB, ça restera ""
        label: a.fileLabel ?? "photo",
      }))
      .filter((p) => !!p.url);

    const { client, restNotes } = extractClientBlock(String(job.notes || ""));

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const w = 595.28; // A4 portrait
    const h = 841.89;
    const margin = 48;

    const cDark = rgb(0.09, 0.21, 0.21);
    const cGray = rgb(0.35, 0.35, 0.35);
    const cLine = rgb(0.88, 0.88, 0.88);

    let logoPng: any = null;
    try {
      const logoBytes = await loadBytesFromPublic(LOGO_PUBLIC_URL);
      logoPng = await pdf.embedPng(logoBytes);
    } catch {
      logoPng = null;
    }

    /** ===== PAGE 1 : header + contenu ===== */
    {
      const page = pdf.addPage([w, h]);
      const yTop = h - margin;

      const leftX = margin;

      const rightBoxW = 280;
      const rightX = w - margin - rightBoxW;

      const logoMax = 56;
      const logoW = logoPng ? logoPng.width * (logoMax / logoPng.height) : 0;
      const logoH = logoPng ? logoMax : 0;

      const logoY = yTop - logoH;

      if (logoPng) {
        page.drawImage(logoPng, { x: leftX, y: logoY, width: logoW, height: logoH });
      }

      const companyX = leftX;
      let companyY = logoY - 18;

      page.drawText(winAnsiSafe(COMPANY.name), {
        x: companyX,
        y: companyY,
        size: 15,
        font: fontBold,
        color: cDark,
      });
      companyY -= 16;

      page.drawText(winAnsiSafe(COMPANY.tagline), {
        x: companyX,
        y: companyY,
        size: 10,
        font,
        color: cGray,
      });

      const title = "FICHE CHANTIER";
      const titleSize = 20;
      const titleW = fontBold.widthOfTextAtSize(title, titleSize);

      page.drawText(title, {
        x: (w - titleW) / 2,
        y: yTop - 6,
        size: titleSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      const boxTop = yTop - 40;
      const boxH = 92;

      page.drawRectangle({
        x: rightX,
        y: boxTop - boxH,
        width: rightBoxW,
        height: boxH,
        borderWidth: 1,
        borderColor: cLine,
      });

      page.drawText("Nom du client", {
        x: rightX + 12,
        y: boxTop - 18,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      const lineLabelX = rightX + 12;
      const lineValueX = rightX + 88;

      const clientLine = (label: string, value: string, yy: number) => {
        page.drawText(winAnsiSafe(label), { x: lineLabelX, y: yy, size: 10, font: fontBold, color: cGray });
        page.drawText(clampText(value || "-", 44), { x: lineValueX, y: yy, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      };

      let cy = boxTop - 36;
      clientLine("Nom :", client.nom, cy);
      cy -= 14;
      clientLine("Tel :", client.tel, cy);
      cy -= 14;
      clientLine("Email :", client.email, cy);

      const addrLines = wrapText(fontBold, client.adresse || "", 9, rightBoxW - 24);
      if (addrLines.length) {
        let ay = boxTop - boxH + 12;
        for (const l of addrLines.slice(0, 2)) {
          page.drawText(l, { x: rightX + 12, y: ay, size: 9, font: fontBold, color: cGray });
          ay -= 11;
        }
      }

      const headerBottomY = Math.min(companyY - 18, boxTop - boxH - 16);
      let y = headerBottomY;

      page.drawLine({ start: { x: margin, y }, end: { x: w - margin, y }, thickness: 1, color: cLine });
      y -= 26;

      page.drawText(clampText(`ID: ${job.id}`, 100), {
        x: margin,
        y,
        size: 9,
        font,
        color: cGray,
      });

      y -= 26;

      page.drawText("Elements du chantier", { x: margin, y, size: 13, font: fontBold, color: cDark });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: w - margin, y }, thickness: 1, color: cLine });
      y -= 18;

      const row = (label: string, value: string) => {
        page.drawText(winAnsiSafe(label), { x: margin, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(clampText(value || "-", 95), { x: margin + 155, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 16;
      };

      row("Titre :", String(job.title ?? "-"));
      row("Type :", String(job.type ?? "-"));
      row("Statut :", String(job.status ?? "-"));
      row("Dates :", `${isoDateFR(startISO)} -> ${isoDateFR(endISO)}`);
      row("Intervenants :", intervenants.length ? intervenants.join(", ") : "-");

      y -= 16;

      page.drawText("Notes intervenant", { x: margin, y, size: 13, font: fontBold, color: cDark });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: w - margin, y }, thickness: 1, color: cLine });
      y -= 16;

      const noteLines = wrapText(font, restNotes || "-", 11, w - margin * 2);
      for (const l of noteLines.slice(0, 38)) {
        page.drawText(l, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 14;
        if (y < 70) break;
      }
    }

    /** ===== PHOTOS : auto multi-pages ===== */
    if (photos.length) {
      let p = pdf.addPage([w, h]);
      let py = h - margin;

      p.drawText("Photos du chantier", { x: margin, y: py, size: 15, font: fontBold, color: rgb(0, 0, 0) });
      py -= 18;
      p.drawLine({ start: { x: margin, y: py }, end: { x: w - margin, y: py }, thickness: 1, color: cLine });
      py -= 20;

      const gap = 12;
      const colW = (w - margin * 2 - gap) / 2;
      const slotH = 210;
      let col = 0;

      for (const ph of photos) {
        if (py - slotH < 60) {
          p = pdf.addPage([w, h]);
          py = h - margin;

          p.drawText("Photos du chantier (suite)", { x: margin, y: py, size: 15, font: fontBold, color: rgb(0, 0, 0) });
          py -= 18;
          p.drawLine({ start: { x: margin, y: py }, end: { x: w - margin, y: py }, thickness: 1, color: cLine });
          py -= 20;

          col = 0;
        }

        const x = col === 0 ? margin : margin + colW + gap;

        try {
          const { bytes, contentType } = await loadBytesFromUrl(ph.url);

          // On décide à partir de fileType (si dispo) sinon content-type fetch
          const type = normalizeMime(ph.type || contentType);
          if (type !== "image/png" && type !== "image/jpeg") {
            throw new Error(`Unsupported image type: ${type}`);
          }

          const img = type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

          const dims = img.scale(1);
          const ratio = dims.width / dims.height;

          const maxImgH = slotH - 26;
          const drawW = colW;
          const drawH = Math.min(maxImgH, drawW / ratio);

          p.drawRectangle({ x, y: py - maxImgH, width: colW, height: maxImgH, borderWidth: 1, borderColor: cLine });

          p.drawImage(img, {
            x: x + (colW - drawW) / 2,
            y: py - maxImgH + (maxImgH - drawH) / 2,
            width: drawW,
            height: drawH,
          });

          p.drawText(clampText(ph.label || "photo", 70), {
            x,
            y: py - maxImgH - 13,
            size: 9,
            font,
            color: cGray,
          });
        } catch {
          p.drawText("Photo illisible (format non supporté)", { x, y: py - 14, size: 10, font, color: cGray });
        }

        if (col === 0) col = 1;
        else {
          col = 0;
          py -= slotH;
        }
      }
    }

    const pdfBytes = await pdf.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="chantier.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}