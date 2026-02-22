import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export async function POST(req: NextRequest, ctx: any) {
  try {
    // 1. Vérification accès
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;
    const form = await req.formData();
    
    // On extrait le fichier envoyé sous la clé "file"
    const file = form.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Fichier manquant dans le formulaire" }, { status: 400 });
    }

    // 2. Upload direct vers Vercel Blob (Cloud)
    // Cela génère une URL publique (https://...public.blob.vercel-storage.com/...)
    const blob = await put(file.name, file, {
      access: "public",
    });

    // 3. Enregistrement en base de données Néon
    const attachment = await prisma.jobAttachment.create({
      data: {
        jobId,
        kind: "PHOTO",
        fileLabel: file.name,
        fileType: file.type || "image/jpeg",
        fileUrl: blob.url, 
        uploadedByUserId: auth.userId,
      },
    });

    return NextResponse.json(attachment);
  } catch (e: any) {
    console.error("Erreur API Photos:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Route pour récupérer les photos existantes
export async function GET(req: NextRequest, ctx: any) {
  try {
    const { id: jobId } = await ctx.params;
    const photos = await prisma.jobAttachment.findMany({
      where: { jobId, kind: "PHOTO" },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(photos);
  } catch (e: any) {
    return NextResponse.json({ error: "Impossible de charger les photos" }, { status: 500 });
  }
}