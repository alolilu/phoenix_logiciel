import { NextResponse } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: any) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;
    
    // On essaie de lire le FormData
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      return NextResponse.json({ error: "Impossible de lire le formulaire (FormData)" }, { status: 400 });
    }
    
    // On cherche n'importe quel fichier présent
    let file: File | null = null;
    const allKeys = [];
    
    for (const [key, value] of formData.entries()) {
      allKeys.push(key);
      if (value instanceof File) {
        file = value;
        break;
      }
    }

    if (!file) {
      return NextResponse.json({ 
        error: "Aucun fichier détecté", 
        cles_recues: allKeys,
        aide: "Vérifiez que l'input file a bien un nom ou que le FormData n'est pas vide." 
      }, { status: 400 });
    }

    // Sécurité Token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Liaison Vercel Blob manquante (Token absent)" }, { status: 500 });
    }

    const blob = await put(file.name, file, { access: "public" });

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
    return NextResponse.json({ error: "Erreur serveur", message: e.message }, { status: 500 });
  }
}