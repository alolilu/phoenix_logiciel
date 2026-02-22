export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

type Ctx = { params: { id: string } };

function safeName(name: string) {
  return (name || "photo")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const jobId = ctx.params.id;

    const form = await req.formData();

    // accepte soit "files" (multiple) soit "file" (single)
    const filesFromFiles = form
      .getAll("files")
      .filter((x): x is File => x instanceof File);

    const single = form.get("file");
    const files =
      filesFromFiles.length > 0
        ? filesFromFiles
        : single instanceof File
          ? [single]
          : [];

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Missing file(s) in multipart/form-data",
          receivedKeys: Array.from(form.keys()),
          hint:
            "Attendu: fd.append('files', file) (ou 'file') et ne PAS forcer Content-Type côté client.",
        },
        { status: 400 }
      );
    }

    const kind = (form.get("kind") as string) ?? "PHOTO";

    const created = [];

    for (const file of files) {
      // Upload vers Vercel Blob (pas de filesystem)
      const blob = await put(
        `phoenix/${jobId}/${Date.now()}-${safeName(file.name)}`,
        file,
        {
          access: "public",
          addRandomSuffix: true,
          contentType: file.type || "application/octet-stream",
        }
      );

      const attachment = await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: kind as any,
          fileLabel: file.name || "photo",
          fileType: file.type || "application/octet-stream",
          fileUrl: blob.url, // ✅ URL Blob
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