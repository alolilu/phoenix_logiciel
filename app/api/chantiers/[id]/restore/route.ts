import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).userId as string | null;
    const role = (session as any).role as string | null;

    if (!userId) {
      return NextResponse.json({ error: "Session userId missing" }, { status: 500 });
    }
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params; // ✅ important (Next 16)

    const updated = await prisma.jobItem.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedById: null,
        archived: false,
      },
    });

    return NextResponse.json({ ok: true, job: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}