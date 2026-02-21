export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

// GET /api/admin/utilisateurs  (ADMIN)
export async function GET(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const users = await prisma.userAccount.findMany({
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return json(users, 200);
}

// POST /api/admin/utilisateurs  (ADMIN) => créer user
export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Body JSON invalide");

  const username = String((body as any).username ?? "").trim();
  const email = String((body as any).email ?? "").trim().toLowerCase();
  const password = String((body as any).password ?? "");
  const role = String((body as any).role ?? "USER").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
  const isActive = typeof (body as any).isActive === "boolean" ? (body as any).isActive : true;

  if (!username) return badRequest("username requis");
  if (!email) return badRequest("email requis");
  if (!password || password.length < 8) return badRequest("password min 8 caractères");

  const existing = await prisma.userAccount.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (existing) return json({ error: "username ou email déjà utilisé" }, 409);

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.userAccount.create({
    data: { username, email, passwordHash, role, isActive },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return json(created, 201);
}

// PUT /api/admin/utilisateurs?id=...  (ADMIN) => modifier user
export async function PUT(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id manquant");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Body JSON invalide");

  const data: any = {};

  if ((body as any).username !== undefined) {
    const username = String((body as any).username ?? "").trim();
    if (!username) return badRequest("username invalide");
    data.username = username;
  }

  if ((body as any).email !== undefined) {
    const email = String((body as any).email ?? "").trim().toLowerCase();
    if (!email) return badRequest("email invalide");
    data.email = email;
  }

  if ((body as any).role !== undefined) {
    const role = String((body as any).role ?? "USER").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
    data.role = role;
  }

  if ((body as any).isActive !== undefined) {
    if (typeof (body as any).isActive !== "boolean") return badRequest("isActive invalide");
    data.isActive = (body as any).isActive;
  }

  if ((body as any).password !== undefined) {
    const password = String((body as any).password ?? "");
    if (!password || password.length < 8) return badRequest("password min 8 caractères");
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  // vérif doublon si email/username changent
  if (data.email || data.username) {
    const other = await prisma.userAccount.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              data.email ? { email: data.email } : undefined,
              data.username ? { username: data.username } : undefined,
            ].filter(Boolean) as any,
          },
        ],
      },
      select: { id: true },
    });
    if (other) return json({ error: "username ou email déjà utilisé" }, 409);
  }

  const updated = await prisma.userAccount.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return json(updated, 200);
}

// DELETE /api/admin/utilisateurs?id=... (ADMIN)
export async function DELETE(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id manquant");

  await prisma.userAccount.delete({ where: { id } });
  return json({ ok: true }, 200);
}
