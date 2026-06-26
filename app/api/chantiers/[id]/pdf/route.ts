// app/api/chantiers/[id]/pdf/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";
import { PDFDocument, StandardFonts, rgb, RGB } from "pdf-lib";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  brand:     rgb(0.09, 0.21, 0.21),
  accent:    rgb(0.608, 0.400, 0.176),
  white:     rgb(1, 1, 1),
  dark:      rgb(0.12, 0.12, 0.12),
  gray:      rgb(0.40, 0.40, 0.40),
  grayLight: rgb(0.62, 0.62, 0.62),
  lineSoft:  rgb(0.84, 0.84, 0.84),
  rowEven:   rgb(0.962, 0.962, 0.962),
  rowOdd:    rgb(0.930, 0.930, 0.930),
  sectionBg: rgb(0.975, 0.975, 0.975),
  notesBg:   rgb(0.945, 0.945, 0.945),
};

const COMPANY = {
  name:    "Phoenix Nouvelle-Aquitaine",
  tagline: "Renaitre proprement, c'est possible !",
  web:     "phoenixnouvelleaquitaine.fr",
  phone:   "06.69.35.93.79",
  email:   "phoenixnouvelleaquitaine@gmail.com",
};
const LOGO_PUBLIC_URL = "/phoenix-logo.png";

type ClientInfo = { nom: string; tel: string; email: string; adresse: string };
type Photo      = { url: string; type: string; label: string };

// ─── Utils date ───────────────────────────────────────────────────────────────
function isoDateFR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function toISODateUTC(d: Date) {
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
function nowFR() {
  return new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Utils texte ──────────────────────────────────────────────────────────────
function winSafe(s: string): string {
  return (s ?? "")
    .replaceAll("\u2192", "->").replaceAll("\u2014", "-").replaceAll("\u2013", "-")
    .replaceAll("\u2018", "'").replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"').replaceAll("\u201D", '"')
    .replaceAll("\u2026", "...").replaceAll("\u2022", "-")
    .replaceAll("\u20AC", "EUR").replaceAll("\u00B0", "deg");
}
function clamp(s: string, n: number): string {
  const t = winSafe(s);
  return t.length > n ? t.slice(0, n - 1) + "~" : t;
}
function wrap(font: any, text: string, size: number, maxW: number): string[] {
  const safe = winSafe(text || "");
  if (!safe.trim()) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of safe.split(/\s+/)) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Utils fichiers ───────────────────────────────────────────────────────────
function toPublicPath(url: string) {
  return path.join(process.cwd(), "public", url.startsWith("/") ? url.slice(1) : url);
}
async function loadPublic(url: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(toPublicPath(url)));
}
async function fetchImage(url: string): Promise<{ bytes: Uint8Array; ct: string }> {
  const ac = new AbortController();
  const t  = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
    return { bytes: new Uint8Array(await res.arrayBuffer()), ct };
  } finally { clearTimeout(t); }
}
function normMime(t: string) {
  const s = (t || "").toLowerCase().split(";")[0].trim();
  return s === "image/jpg" ? "image/jpeg" : s;
}

// ─── Extraction CLIENT ────────────────────────────────────────────────────────
function extractClient(notesRaw: string): { client: ClientInfo; restNotes: string } {
  const raw   = String(notesRaw || "");
  const empty: ClientInfo = { nom: "", tel: "", email: "", adresse: "" };
  const s = raw.indexOf("[[CLIENT]]");
  const e = raw.indexOf("[[/CLIENT]]");
  if (s === -1 || e === -1 || e <= s) return { client: empty, restNotes: raw.trim() || "-" };
  const block = raw.slice(s + 10, e).trim();
  const rest  = (raw.slice(0, s) + raw.slice(e + 11)).trim();
  const client = { ...empty };
  for (const line of block.split(/\r?\n/)) {
    const [k, ...vv] = line.split("=");
    const key = (k || "").trim().toLowerCase();
    const val = vv.join("=").trim();
    if (!val) continue;
    if (key === "nom")                          client.nom    = val;
    if (key === "tel" || key === "telephone")   client.tel    = val;
    if (key === "email" || key === "mail")      client.email  = val;
    if (key === "adresse" || key === "address") client.adresse = val;
  }
  return { client, restNotes: rest || "-" };
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function fillRect(page: any, x: number, y: number, w: number, h: number, color: RGB) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}
function t(page: any, text: string, x: number, y: number, size: number, font: any, color: RGB) {
  page.drawText(winSafe(text), { x, y, size, font, color });
}

// ─── SECTION BLOCK ────────────────────────────────────────────────────────────
function drawSectionBar(
  page: any, fontBold: any,
  label: string,
  x: number, y: number, w: number,
  totalContentH: number,
  accentBar = true,
): number {
  const BAR_H = 22;

  fillRect(page, x, y - BAR_H - totalContentH, w, BAR_H + totalContentH, C.sectionBg);

  if (accentBar) {
    fillRect(page, x, y - BAR_H - totalContentH, 3, BAR_H + totalContentH, C.accent);
  }

  // Barre titre verte
  fillRect(page, x, y - BAR_H, w, BAR_H, C.brand);
  t(page, label, x + 12, y - BAR_H + 7, 10, fontBold, C.white);

  return y - BAR_H;
}

// ─── LIGNE TABLEAU ZÉBRÉE ─────────────────────────────────────────────────────
function drawTableRow(
  page: any, font: any, fontBold: any,
  label: string, value: string,
  x: number, y: number,
  labelColW: number, totalW: number,
  rowIndex: number,
): number {
  const ROW_H  = 22;
  const TEXT_Y = y - ROW_H + 7;
  const bg     = rowIndex % 2 === 0 ? C.rowEven : C.rowOdd;

  fillRect(page, x, y - ROW_H, totalW, ROW_H, bg);
  page.drawLine({
    start: { x: x + 3, y: y - ROW_H },
    end:   { x: x + totalW, y: y - ROW_H },
    thickness: 0.3, color: C.lineSoft,
  });

  t(page, clamp(label, 32), x + 12,             TEXT_Y, 10, fontBold, C.dark);
  t(page, clamp(value, 72), x + labelColW + 10, TEXT_Y, 10, font,     C.dark);

  return y - ROW_H;
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
async function drawHeader(
  page: any,
  fontBold: any,
  font: any,
  logoPng: any,
  W: number,
  HEADER_H: number,
) {
  const pageH = page.getHeight();
  fillRect(page, 0, pageH - HEADER_H, W, HEADER_H, C.brand);
  fillRect(page, 0, pageH - HEADER_H - 5, W, 5, C.accent);

  const PAD  = 40;
  const midY = pageH - HEADER_H / 2;

  let textStartX = PAD;
  if (logoPng) {
    const lH = 44;
    const lW = logoPng.width * (lH / logoPng.height);
    page.drawImage(logoPng, { x: PAD, y: midY - lH / 2, width: lW, height: lH });
    textStartX = PAD + lW + 16;
  }

  const MAIN_SIZE = 13;
  const SUB_SIZE  = 9;
  const textBlockH = MAIN_SIZE + 7 + SUB_SIZE;
  const textTopY   = midY + textBlockH / 2;

  t(page, COMPANY.name,    textStartX, textTopY - MAIN_SIZE,                  MAIN_SIZE, fontBold, C.white);
  t(page, COMPANY.tagline, textStartX, textTopY - MAIN_SIZE - 7 - SUB_SIZE,   SUB_SIZE,  font,     rgb(0.75, 0.90, 0.90));

  const fcLabel = "FICHE CHANTIER";
  const fcW     = fontBold.widthOfTextAtSize(fcLabel, MAIN_SIZE);
  t(page, fcLabel, W - PAD - fcW, textTopY - MAIN_SIZE, MAIN_SIZE, fontBold, C.white);

  const dateStr = `Edite le : ${nowFR()}`;
  const dateW   = font.widthOfTextAtSize(dateStr, SUB_SIZE);
  t(page, dateStr, W - PAD - dateW, textTopY - MAIN_SIZE - 7 - SUB_SIZE, SUB_SIZE, font, rgb(0.75, 0.90, 0.90));
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function drawFooter(page: any, font: any, W: number, pageNum: number) {
  const y = 22;
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: W - 40, y: y + 14 }, thickness: 0.5, color: C.lineSoft });
  t(page, COMPANY.web, 40, y, 8, font, C.grayLight);
  const pTxt = `Page ${pageNum}`;
  t(page, pTxt, W - 40 - font.widthOfTextAtSize(pTxt, 8), y, 8, font, C.grayLight);
}

// ══════════════════════════════════════════════════════════════════════════════
//  HANDLER
// ══════════════════════════════════════════════════════════════════════════════
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
    const endISO   = toISODateUTC(new Date(job.endAt));
    const intervenants = (job.staffLinks || [])
      .map((l) => `${l.staff?.firstName ?? ""} ${l.staff?.lastName ?? ""}`.trim())
      .filter(Boolean);

    const photos: Photo[] = (job.attachments || [])
      .map((a) => ({ url: a.fileUrl ?? "", type: normMime((a as any).fileType ?? ""), label: a.fileLabel ?? "photo" }))
      .filter((p) => !!p.url);

    const { client, restNotes } = extractClient(String(job.notes || ""));

    const pdf      = await PDFDocument.create();
    const font     = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const W        = 595.28;
    const H        = 841.89;
    const HEADER_H = 76;
    const FOOTER_H = 44;
    const ML       = 40;
    const MR       = 40;
    const BODY_W   = W - ML - MR;
    const Y_START  = H - HEADER_H - 5 - 24;

    let logoPng: any = null;
    try { logoPng = await pdf.embedPng(await loadPublic(LOGO_PUBLIC_URL)); } catch {  }

    let pageNum  = 1;
    const ROW_H  = 22;
    const BAR_H  = 22;
    const LABEL_COL = 140;

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    {
      const page = pdf.addPage([W, H]);
      await drawHeader(page, fontBold, font, logoPng, W, HEADER_H);
      drawFooter(page, font, W, pageNum++);

      let y = Y_START;

      const phoenixRows: [string, string][] = [
        ["Telephone", "06.69.35.93.79"], 
        ["Email",     "phoenixnouvelleaquitaine@gmail.com"], 
        ["Site web",  COMPANY.web],
      ];
      const phoenixContentH = phoenixRows.length * ROW_H;
      y = drawSectionBar(page, fontBold, "Coordonnées Phoenix Nouvelle-Aquitaine", ML, y, BODY_W, phoenixContentH);
      for (let i = 0; i < phoenixRows.length; i++) {
        const [lbl, val] = phoenixRows[i]!;
        y = drawTableRow(page, font, fontBold, lbl, val, ML, y, LABEL_COL, BODY_W, i);
      }
      y -= 16;

      const clientRows: [string, string][] = [
        ["Nom",     client.nom],
        ["Tel",     client.tel],
        ["Email",   client.email],
        ["Adresse", client.adresse],
      ];
      const clientContentH = clientRows.length * ROW_H;
      y = drawSectionBar(page, fontBold, "Informations client", ML, y, BODY_W, clientContentH);

      for (let i = 0; i < clientRows.length; i++) {
        const [lbl, val] = clientRows[i]!;
        y = drawTableRow(page, font, fontBold, lbl, val, ML, y, LABEL_COL, BODY_W, i);
      }

      y -= 16;

      const chantierRows: [string, string][] = [
        ["Titre",        String(job.title ?? "-")],
        ["Type",         String(job.type  ?? "-")],
        ["Statut",       job.status === "EN_ATTENTE" ? "En attente" : job.status === "EN_COURS" ? "En cours" : "Termine"],
        ["Date debut",   isoDateFR(startISO)],
        ["Date fin",     isoDateFR(endISO)],
        ["Intervenants", intervenants.length ? intervenants.join(", ") : "-"],
      ];
      const chantierContentH = chantierRows.length * ROW_H;
      y = drawSectionBar(page, fontBold, "Élements du chantier", ML, y, BODY_W, chantierContentH);

      for (let i = 0; i < chantierRows.length; i++) {
        const [lbl, val] = chantierRows[i]!;
        y = drawTableRow(page, font, fontBold, lbl, val, ML, y, LABEL_COL, BODY_W, i);
      }

      y -= 16;

      const noteLines = wrap(font, restNotes || "-", 10, BODY_W - 20);
      const visibleLines = noteLines.filter((_, i) => {
        const projectedY = y - BAR_H - (i + 1) * 15;
        return projectedY > FOOTER_H + 10;
      });
      const notesContentH = Math.max(ROW_H, visibleLines.length * 15 + 10);
      fillRect(page, ML, y - BAR_H - notesContentH, BODY_W, BAR_H + notesContentH, C.notesBg);
      fillRect(page, ML, y - BAR_H, BODY_W, BAR_H, C.brand);
      t(page, "Notes intervenant", ML + 12, y - BAR_H + 7, 10, fontBold, C.white);
      y -= BAR_H;
      y -= 6;

      for (const l of visibleLines) {
        t(page, l, ML + 12, y - 10, 10, font, C.dark);
        y -= 15;
      }
    }

    if (photos.length) {
      let page = pdf.addPage([W, H]);
      await drawHeader(page, fontBold, font, logoPng, W, HEADER_H);
      drawFooter(page, font, W, pageNum++);

      const GAP    = 14;
      const COL_W  = (BODY_W - GAP) / 2;
      const SLOT_H = 200;
      const IMG_H  = SLOT_H - 22;
      let py  = Y_START;
      let col = 0;

      const photoBarH = BAR_H;
      fillRect(page, ML, py - photoBarH, BODY_W, photoBarH, C.brand);
      t(page, `Photos du chantier (${photos.length})`, ML + 12, py - photoBarH + 7, 10, fontBold, C.white);
      py -= photoBarH + 10;

      for (const ph of photos) {
        if (py - SLOT_H < FOOTER_H + 10) {
          page = pdf.addPage([W, H]);
          await drawHeader(page, fontBold, font, logoPng, W, HEADER_H);
          drawFooter(page, font, W, pageNum++);
          py  = Y_START;
          fillRect(page, ML, py - photoBarH, BODY_W, photoBarH, C.brand);
          t(page, "Photos du chantier (suite)", ML + 12, py - photoBarH + 7, 10, fontBold, C.white);
          py -= photoBarH + 10;
          col = 0;
        }

        const x = col === 0 ? ML : ML + COL_W + GAP;

        try {
          const { bytes, ct } = await fetchImage(ph.url);
          const mime = normMime(ph.type || ct);
          if (mime !== "image/png" && mime !== "image/jpeg") throw new Error("format non supporte");
          const img   = mime === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const dims  = img.scale(1);
          const ratio = dims.width / dims.height;
          const dW    = COL_W;
          const dH    = Math.min(IMG_H, dW / ratio);

          fillRect(page, x, py - IMG_H, COL_W, IMG_H, C.white);
          page.drawImage(img, {
            x: x + (COL_W - dW) / 2,
            y: py - IMG_H + (IMG_H - dH) / 2,
            width: dW, height: dH,
          });
        } catch {
          fillRect(page, x, py - IMG_H, COL_W, IMG_H, C.sectionBg);
          page.drawRectangle({ x, y: py - IMG_H, width: COL_W, height: IMG_H, borderColor: C.lineSoft, borderWidth: 0.8 });
          t(page, "Image non disponible", x + 10, py - IMG_H / 2, 9, font, C.grayLight);
        }

        if (col === 0) { col = 1; }
        else { col = 0; py -= SLOT_H; }
      }
    }

    // ── Export ────────────────────────────────────────────────────────────────
    const pdfBytes  = await pdf.save();
    const safeTitle = winSafe(String(job.title ?? "chantier")).replace(/\s+/g, "-").slice(0, 60);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="${safeTitle}.pdf"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (e: any) {
    console.error("PDF generation error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}