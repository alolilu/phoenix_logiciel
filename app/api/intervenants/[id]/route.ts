import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  return id ? String(id) : null;
}

function splitFullName(fullName: string) {
  const parts = String(fullName || "").trim().split(" ").filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
}

// ✅ PATCH: ADMIN only
export async function PATCH(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const id = getIdFromUrl(req);
  if (!id) return json({ error: "ID manquant" }, 400);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Body JSON invalide" }, 400);

  const fullName = (body as any).fullName !== undefined ? String((body as any).fullName ?? "").trim() : undefined;

  const phoneNumber = (body as any).phoneNumber !== undefined ? String((body as any).phoneNumber ?? "").trim() : undefined;
  const notes = (body as any).notes !== undefined ? String((body as any).notes ?? "").trim() : undefined;
  const isActive = (body as any).isActive !== undefined ? Boolean((body as any).isActive) : undefined;

  const data: any = {};

  if (fullName !== undefined) {
    if (!fullName) return json({ error: "fullName requis" }, 400);
    const { firstName, lastName } = splitFullName(fullName);
    if (!firstName) return json({ error: "firstName requis" }, 400);
    data.firstName = firstName;
    data.lastName = lastName;
  }

  if (phoneNumber !== undefined) data.phoneNumber = phoneNumber || null;
  if (notes !== undefined) data.notes = notes || null;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.staffMember.update({
    where: { id },
    data,
  });

  return json(
    {
      id: updated.id,
      fullName: `${updated.firstName} ${updated.lastName}`.trim(),
      phoneNumber: updated.phoneNumber,
      notes: updated.notes,
      isActive: updated.isActive,
    },
    200
  );
}

// ✅ DELETE: soft delete (ADMIN only)
export async function DELETE(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const id = getIdFromUrl(req);
  if (!id) return json({ error: "ID manquant" }, 400);

  const updated = await prisma.staffMember.update({
    where: { id },
    data: { isActive: false },
  });

  return json({ ok: true, id: updated.id }, 200);
}
