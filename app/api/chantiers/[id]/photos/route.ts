export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id: jobId } = await ctx.params;

    const form = await req.formData();

    // ✅ On accepte plusieurs photos:
    // - soit "files" (recommandé)
    // - soit "file" (fallback)
    const filesFromFiles = form.getAll("files").filter((x): x is File => x instanceof File);
    const fileSingle = form.get("file");
    const files =
      filesFromFiles.length > 0
        ? filesFromFiles
        : fileSingle instanceof File
        ? [fileSingle]
        : [];

    if (!jobId) return NextResponse.json({ error: "id (jobId) manquant dans l'URL" }, { status: 400 });
    if (files.length === 0) {
      return NextResponse.json({ error: "Missing file (multipart/form-data: files)" }, { status: 400 });
    }

    const kind = (form.get("kind") as string) ?? "PHOTO";

    // ⚠️ Stockage actuel: filesystem (OK pour test, PAS fiable sur Vercel)
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const created = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = (file.name || "photo").replace(/\s+/g, "_");
      const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/${fileName}`;

      const attachment = await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: kind as any,
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
    return NextResponse.json({ error: e?.message ?? "Erreur serveur photos" }, { status: 500 });
  }
}