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
    
    // STRATÉGIE DE SECOURS : On prend la première entrée qui est un fichier
    let file: File | null = null;
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        file = value;
        break; 
      }
    }

    if (!file) {
      const keys = Array.from(formData.keys());
      return NextResponse.json({ 
        error: "Aucun fichier détecté dans le formulaire",
        cles_recues: keys,
        methode: req.method,
        type: req.headers.get("content-type")
      }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Variable BLOB_READ_WRITE_TOKEN manquante" }, { status: 500 });
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
    return NextResponse.json({ error: "Erreur serveur", details: e.message }, { status: 500 });
  }
}