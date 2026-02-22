export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";
import { put } from "@vercel/blob";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;

    const form = await req.formData();
    const keys = Array.from(form.keys());

    // On accepte "files" (multi) et "file" (single)
    const filesFromFiles = form.getAll("files").filter((x): x is File => x instanceof File);
    const fileSingle = form.get("file");
    const files =
      filesFromFiles.length > 0
        ? filesFromFiles
        : fileSingle instanceof File
          ? [fileSingle]
          : [];

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Missing file(s) in multipart/form-data",
          receivedKeys: keys,
          hint:
            "Envoie un vrai File via FormData (fd.append('files', file) ou fd.append('file', file)) SANS fixer le header Content-Type.",
        },
        { status: 400 }
      );
    }

    const kind = (form.get("kind") as string) ?? "PHOTO";

    const created = [];

    for (const file of files) {
      // Upload dans Vercel Blob
      const safeName = (file.name || "photo").replace(/\s+/g, "_");
      const blobPath = `phoenix/${jobId}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

      const blob = await put(blobPath, file, {
        access: "public", // pour pouvoir afficher directement dans l'app
        contentType: file.type || "application/octet-stream",
        addRandomSuffix: false,
      });

      // En base : on stocke une URL blob publique
      const attachment = await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: kind as any,
          fileLabel: file.name,
          fileType: file.type || "application/octet-stream",
          fileUrl: blob.url, // <-- IMPORTANT : URL blob
          uploadedByUserId: auth.userId,
        },
      });

      created.push(attachment);
    }

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erreur serveur photos" },
      { status: 500 }
    );
  }
}