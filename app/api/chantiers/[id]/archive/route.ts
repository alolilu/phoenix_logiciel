import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

    const { id } = await ctx.params; // ✅ Next 16.1.1: params est une Promise

    const updated = await prisma.jobItem.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedById: userId,
        archived: true,
      },
    });

    return NextResponse.json({ ok: true, job: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}