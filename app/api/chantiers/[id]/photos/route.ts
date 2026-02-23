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
    const formData = await req.formData();
    
    // On cherche n'importe quelle clé qui contient un fichier
    let fileToUpload: File | null = null;
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        fileToUpload = value;
        break;
      }
    }

    if (!fileToUpload) {
      return NextResponse.json({ error: "Missing file (multipart/form-data: file)" }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Vercel Blob Token manquant" }, { status: 500 });
    }

    const blob = await put(fileToUpload.name, fileToUpload, { access: "public" });

    const attachment = await prisma.jobAttachment.create({
      data: {
        jobId,
        kind: "PHOTO",
        fileLabel: fileToUpload.name,
        fileType: fileToUpload.type || "image/jpeg",
        fileUrl: blob.url,
        uploadedByUserId: auth.userId,
      },
    });

    return NextResponse.json(attachment);
  } catch (e: any) {
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
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}