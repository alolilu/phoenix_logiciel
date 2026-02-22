export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

type Ctx = { params: { id: string } };

function safeName(name: string) {
  return (name || "photo")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;

    const form = await req.formData();

    // accepte "files" (multiple) OU "file" (single)
    const filesFromFiles = form
      .getAll("files")
      .filter((f): f is File => f instanceof File);

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
          error: "Missing file (multipart/form-data: file)",
          receivedKeys: Array.from(form.keys()),
        },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const created = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const safeName = (file.name || "photo").replace(/\s+/g, "_");
      const fileName = `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}-${safeName}`;

      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/${fileName}`;

      const attachment = await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: "PHOTO",
          fileLabel: file.name,
          fileType: file.type || "application/octet-stream",
          fileUrl,
          uploadedByUserId: auth.userId,
        },
      });

      created.push(attachment);
    }

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erreur upload photos" },
      { status: 500 }
    );
  }
}