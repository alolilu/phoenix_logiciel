import { NextResponse } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: any) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const params = await ctx.params;
    const jobId = params.id;
    
    const formData = await req.formData();
    
    // On essaie de récupérer le fichier avec la clé "file"
    const file = formData.get("file") as File;

    if (!file) {
      // Si on ne trouve pas "file", on regarde toutes les clés reçues pour aider au débug
      const receivedKeys = Array.from(formData.keys());
      console.error("Clés reçues par l'API:", receivedKeys);
      return NextResponse.json({ 
        error: "Missing file (multipart/form-data: file)",
        debug_recu: receivedKeys 
      }, { status: 400 });
    }

    // Vérification de la configuration Vercel
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Config Vercel Blob manquante" }, { status: 500 });
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
    console.error("Crash API Photos:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: any) {
  try {
    const params = await ctx.params;
    const photos = await prisma.jobAttachment.findMany({
      where: { jobId: params.id, kind: "PHOTO" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(photos);
  } catch (e: any) {
    return NextResponse.json({ error: "Erreur chargement" }, { status: 500 });
  }
}