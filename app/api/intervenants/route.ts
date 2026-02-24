import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/rbac";
import { StaffRole } from "@prisma/client";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeRole(role: any): StaffRole {
  const r = String(role || "").toUpperCase().trim();
  if (r === "GERANT") return "GERANT";
  if (r === "PRESTATAIRE") return "PRESTATAIRE";
  return "TECHNICIEN";
}

function fullNameOf(m: { firstName: string; lastName: string }) {
  return `${m.firstName} ${m.lastName}`.trim();
}

/**
 * GET /api/intervenants
 * Lecture: USER + ADMIN
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); // ✅ plus besoin de req
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const items = await prisma.staffMember.findMany({
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  const dto = items.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    fullName: fullNameOf(m),
    email: m.email ?? null,
    phoneNumber: m.phoneNumber ?? null,
    role: m.role,
    notes: m.notes ?? null,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

  return json(dto, 200);
}

/**
 * POST /api/intervenants
 * Ecriture: ADMIN only
 */
export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req); // ✅ plus besoin de req
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Body JSON invalide" }, 400);

  const fullName = String((body as any).fullName ?? "").trim();
  const phoneNumber = String((body as any).phoneNumber ?? "").trim() || null;
  const email = String((body as any).email ?? "").trim() || null;
  const notes = String((body as any).notes ?? "").trim() || null;
  const isActive = typeof (body as any).isActive === "boolean" ? (body as any).isActive : true;
  const role = normalizeRole((body as any).role);

  if (!fullName) return json({ error: "fullName requis" }, 400);

  const parts = fullName.split(" ").filter(Boolean);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.slice(1).join(" ") || "-";

  if (email) {
    const existingEmail = await prisma.staffMember.findFirst({ where: { email } });
    if (existingEmail) return json({ error: "Email déjà utilisé" }, 409);
  }

  const created = await prisma.staffMember.create({
    data: { firstName, lastName, email, phoneNumber, role, notes, isActive },
  });

  return json(
    {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      fullName: fullNameOf(created),
      email: created.email ?? null,
      phoneNumber: created.phoneNumber ?? null,
      role: created.role,
      notes: created.notes ?? null,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
    201
  );
}

/**
 * PUT /api/intervenants?id=...
 * Ecriture: ADMIN only
 */
export async function PUT(req: NextRequest) {
  const auth = await requireWriteAccess(req); // ✅ plus besoin de req
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return json({ error: "id manquant" }, 400);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Body JSON invalide" }, 400);

  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) return json({ error: "Intervenant introuvable" }, 404);

  const fullName = (body as any).fullName !== undefined ? String((body as any).fullName ?? "").trim() : null;
  const phoneNumber =
    (body as any).phoneNumber !== undefined ? String((body as any).phoneNumber ?? "").trim() || null : undefined;
  const email = (body as any).email !== undefined ? String((body as any).email ?? "").trim() || null : undefined;
  const notes = (body as any).notes !== undefined ? String((body as any).notes ?? "").trim() || null : undefined;
  const isActive = typeof (body as any).isActive === "boolean" ? (body as any).isActive : undefined;
  const role = (body as any).role !== undefined ? normalizeRole((body as any).role) : undefined;

  let firstName: string | undefined = undefined;
  let lastName: string | undefined = undefined;
  if (fullName !== null) {
    if (!fullName) return json({ error: "fullName invalide" }, 400);
    const parts = fullName.split(" ").filter(Boolean);
    firstName = parts[0] ?? fullName;
    lastName = parts.slice(1).join(" ") || "-";
  }

  if (email !== undefined && email) {
    const other = await prisma.staffMember.findFirst({
      where: { email, NOT: { id } },
    });
    if (other) return json({ error: "Email déjà utilisé" }, 409);
  }

  const updated = await prisma.staffMember.update({
    where: { id },
    data: { firstName, lastName, phoneNumber, email, notes, isActive, role },
  });

  return json(
    {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      fullName: fullNameOf(updated),
      email: updated.email ?? null,
      phoneNumber: updated.phoneNumber ?? null,
      role: updated.role,
      notes: updated.notes ?? null,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
    200
  );
}

/**
 * DELETE /api/intervenants?id=...
 * Ecriture: ADMIN only
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireWriteAccess(req); // ✅ plus besoin de req
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return json({ error: "id manquant" }, 400);

  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) return json({ error: "Intervenant introuvable" }, 404);

  await prisma.staffMember.delete({ where: { id } });
  return json({ ok: true }, 200);
}
