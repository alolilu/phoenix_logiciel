import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type PhotoDTO = {
  id: string;
  fileUrl: string;
  fileLabel: string;
  uploadedAt: string;
};

function safeFilename(name: string) {
  const base = (name || "photo").replace(/\\/g, "/").split("/").pop()!;
  return base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
}

async function listPhotos(jobId: string): Promise<PhotoDTO[]> {
  const rows = await prisma.jobAttachment.findMany({
    where: { jobId, kind: "PHOTO" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, fileUrl: true, fileLabel: true, uploadedAt: true },
  });

  return rows
    .filter((r) => !!r.fileUrl)
    .map((r) => ({
      id: r.id,
      fileUrl: r.fileUrl || "",
      fileLabel: r.fileLabel || "photo",
      uploadedAt: r.uploadedAt.toISOString(),
    }));
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await params;
    const photos = await listPhotos(jobId);
    return NextResponse.json(photos, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await params;
    const formData = await req.formData();

    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(
      (v): v is File => v instanceof File
    );

    if (files.length === 0) {
      return NextResponse.json({ error: "Missing file (multipart/form-data: file|files)" }, { status: 400 });
    }

    const allowed = new Set(["image/jpeg", "image/png"]);
    const MAX_FILES = 15;
    const MAX_SIZE_BYTES = 15 * 1024 * 1024;

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Trop de fichiers (max ${MAX_FILES})` }, { status: 400 });
    }

    for (const f of files) {
      if (f.size > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: `Fichier trop gros: ${f.name}` }, { status: 400 });
      }
      if (!allowed.has(f.type)) {
        return NextResponse.json(
          { error: `Format non supporté pour PDF: ${f.name} (${f.type}). Utilise JPG/PNG.` },
          { status: 400 }
        );
      }

      const filename = safeFilename(f.name);
      const pathname = `phoenix-ops/chantiers/${jobId}/${Date.now()}-${filename}`;

      const blob = await put(pathname, f, {
        access: "public",
        addRandomSuffix: true,
        contentType: f.type,
      });

      await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: "PHOTO",
          fileUrl: blob.url,
          fileLabel: filename,
          fileType: f.type, // ✅ important pour PDF
        },
      });
    }

    const photos = await listPhotos(jobId);
    return NextResponse.json(photos, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: 500 });
  }
}