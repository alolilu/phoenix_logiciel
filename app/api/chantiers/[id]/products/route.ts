export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { id } = await ctx.params;

  const items = await prisma.jobProductUsed.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "asc" },
  });

  return json(items, 200);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Body JSON invalide" }, 400);

  const name = String((body as any).name ?? "").trim();
  if (!name) return json({ error: "name requis" }, 400);

  const quantityRaw = (body as any).quantity;
  const quantity =
    quantityRaw === null || quantityRaw === undefined || quantityRaw === ""
      ? null
      : Number(quantityRaw);

  if (quantity !== null && Number.isNaN(quantity)) return json({ error: "quantity invalide" }, 400);

  const unit =
    (body as any).unit !== undefined ? String((body as any).unit ?? "").trim() : null;

  const notes =
    (body as any).notes !== undefined ? String((body as any).notes ?? "").trim() : null;

  // vérif job
  const job = await prisma.jobItem.findUnique({ where: { id } });
  if (!job) return json({ error: "Chantier introuvable" }, 404);

  const created = await prisma.jobProductUsed.create({
    data: {
      jobId: id,
      name,
      quantity: quantity === null ? null : quantity,
      unit: unit || null,
      notes: notes || null,
    },
  });

  return json(created, 201);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) return json({ error: "productId manquant" }, 400);

  // sécurité: s'assurer que ce produit appartient au job
  const existing = await prisma.jobProductUsed.findFirst({
    where: { id: productId, jobId: id },
  });
  if (!existing) return json({ error: "Produit introuvable" }, 404);

  await prisma.jobProductUsed.delete({ where: { id: productId } });
  return json({ ok: true }, 200);
}
