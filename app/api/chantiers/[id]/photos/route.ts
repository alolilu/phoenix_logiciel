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
    // On essaye de récupérer 'file' (minuscule) qui est le standard
    const file = formData.get("file") as File;

    if (!file) {
      console.error("ERREUR 400: Aucun fichier trouvé dans le FormData. Clés reçues:", Array.from(formData.keys()));
      return NextResponse.json({ error: "Fichier manquant dans la requête" }, { status: 400 });
    }

    // Vérification de la présence du Token Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("ERREUR 500: BLOB_READ_WRITE_TOKEN manquant.");
      return NextResponse.json({ error: "Configuration Storage manquante sur Vercel" }, { status: 500 });
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
    console.error("CRASH API PHOTOS:", e);
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