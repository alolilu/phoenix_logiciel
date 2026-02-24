import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id: jobId } = await params;

    const photos = await prisma.jobAttachment.findMany({
      where: { jobId, kind: "PHOTO" },
      orderBy: { uploadedAt: "desc" }, // <-- dans ton schema: uploadedAt (pas createdAt)
    });

    return NextResponse.json(photos);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: jobId } = await params;

    const formData = await req.formData();

    // accepte "file" (1 fichier) ou "files" (multi)
    const files = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Missing file (multipart/form-data: file)' },
        { status: 400 }
      );
    }

    // Ici: tu ne m’as pas confirmé ton stockage (Vercel Blob / local / etc.)
    // Donc je ne code PAS l’upload ici pour éviter d’inventer.
    // On valide juste la réception des fichiers + on renvoie un message clair.
    return NextResponse.json(
      { ok: true, received: files.length, jobId },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: 500 });
  }
}