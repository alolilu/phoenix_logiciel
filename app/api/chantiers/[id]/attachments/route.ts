export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;

    const attachments = await prisma.jobAttachment.findMany({
      where: { jobId: id, kind: "PHOTO" },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        fileUrl: true,
        fileLabel: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json(attachments);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
