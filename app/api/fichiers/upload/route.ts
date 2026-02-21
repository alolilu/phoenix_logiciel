export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;
    const kind = (formData.get("kind") as string) ?? "PHOTO";

    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    if (!jobId) return NextResponse.json({ error: "jobId manquant" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${fileName}`;

    const attachment = await prisma.jobAttachment.create({
      data: {
        jobId,
        kind: kind as any,
        fileLabel: file.name,
        fileType: file.type,
        fileUrl,
        uploadedByUserId: auth.userId,
      },
    });

    return NextResponse.json(attachment);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erreur serveur upload" },
      { status: 500 }
    );
  }
}
