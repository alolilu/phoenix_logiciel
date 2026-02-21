export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

function safeExtFromMimeOrName(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (m.includes("png") || n.endsWith(".png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg") || n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (m.includes("webp") || n.endsWith(".webp")) return "webp";

  return "jpg";
}

function normalizeMime(mime: string, ext: string) {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return m;

  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

// ✅ Extraction safe de l'userId sans dépendre du typage de requireWriteAccess
function getUserIdFromAuth(auth: unknown): string | null {
  const a = auth as any;
  const id =
    a?.user?.id ??
    a?.userId ??
    a?.session?.user?.id ??
    null;

  return id ? String(id) : null;
}

/**
 * GET /api/chantiers/:id/photos
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await ctx.params;

    const photos = await prisma.jobAttachment.findMany({
      where: { jobId: id, kind: "PHOTO" },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        kind: true,
        fileLabel: true,
        fileType: true,
        fileUrl: true,
        uploadedByUserId: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json(photos, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/chantiers/:id/photos
 * multipart/form-data (file)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await ctx.params;

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file (multipart/form-data: file)" }, { status: 400 });
    }

    const ext = safeExtFromMimeOrName(file.type || "", file.name || "");
    const mime = normalizeMime(file.type || "", ext);

    const bytes = Buffer.from(await file.arrayBuffer());

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `photo_${stamp}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "chantiers", id);
    await fs.mkdir(uploadDir, { recursive: true });

    const absPath = path.join(uploadDir, filename);
    await fs.writeFile(absPath, bytes);

    const fileUrl = `/uploads/chantiers/${id}/${filename}`;

    // ✅ plus de rouge : on ne touche pas auth.user directement
    const uploaderId = getUserIdFromAuth(auth);

    const created = await prisma.jobAttachment.create({
      data: {
        jobId: id,
        kind: "PHOTO",
        fileLabel: file.name ? String(file.name) : filename,
        fileType: mime,
        fileUrl,
        uploadedByUserId: uploaderId,
      },
      select: {
        id: true,
        kind: true,
        fileLabel: true,
        fileType: true,
        fileUrl: true,
        uploadedByUserId: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({ ok: true, attachment: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}