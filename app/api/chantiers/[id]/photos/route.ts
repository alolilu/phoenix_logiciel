import { NextResponse } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: any) {
  try {
    // 1. Vérification des accès
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // 2. Récupération de l'ID du chantier
    const { id: jobId } = await ctx.params;
    
    // 3. Extraction du fichier du FormData
    const formData = await req.formData();
    // On vérifie "file" et "files" pour être ultra-sécurisé
    const file = (formData.get("file") || formData.get("files")) as File;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file (multipart/form-data: file)" }, { status: 400 });
    }

    // 4. Upload vers Vercel Blob (Indispensable pour le déploiement)
    const blob = await put(file.name, file, {
      access: "public",
    });

    // 5. Enregistrement dans la base Néon via Prisma
    const attachment = await prisma.jobAttachment.create({
      data: {
        jobId,
        kind: "PHOTO",
        fileLabel: file.name,
        fileType: file.type || "image/jpeg",
        fileUrl: blob.url, // L'URL publique Vercel
        uploadedByUserId: auth.userId,
      },
    });

    return NextResponse.json(attachment);
  } catch (e: any) {
    console.error("Erreur API Upload:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: any) {
  try {
    const { id: jobId } = await ctx.params;
    const photos = await prisma.jobAttachment.findMany({
      where: { jobId, kind: "PHOTO" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(photos);
  } catch (e: any) {
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}