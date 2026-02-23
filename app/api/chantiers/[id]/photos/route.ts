import { NextResponse } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: any) {
  try {
    // Sécurité interne puisque le middleware est bypassé
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;
    const formData = await req.formData();
    
    // On récupère le fichier (on accepte "file" ou "files")
    const file = (formData.get("file") || formData.get("files")) as File;

    if (!file) {
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Config Storage absente sur Vercel" }, { status: 500 });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}