export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

/**
 * Convertit en username "prenom.nom" (minuscules, sans accents, caractères sûrs).
 * Ex: "Matéo" + "Mazzer" => "mateo.mazzer"
 */
function slugifyUsername(firstName: string, lastName: string) {
  const normalize = (s: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // enlève accents
      .replace(/[^a-z0-9]+/g, ".") // tout ce qui n'est pas alphanum -> "."
      .replace(/\.+/g, ".") // points multiples -> 1
      .replace(/^\.|\.$/g, ""); // pas de point au début/fin

  const fn = normalize(firstName);
  const ln = normalize(lastName);

  const base = [fn, ln].filter(Boolean).join(".");
  return base;
}

function normalizeRole(input: unknown): "ADMIN" | "USER" {
  const role = String(input ?? "USER").toUpperCase();
  return role === "ADMIN" ? "ADMIN" : "USER";
}

function readBool(input: unknown, fallback: boolean) {
  return typeof input === "boolean" ? input : fallback;
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

  // ✅ Champs acceptés (tolérant avec le front actuel)
  const firstName = String((body as any).firstName ?? "").trim();
  const lastName = String((body as any).lastName ?? "").trim();

  // username peut venir de:
  // - body.username (idéal)
  // - body.identifiant (si ton front l'appelle comme ça)
  // - sinon on le génère depuis firstName/lastName
  const usernameRaw =
    (body as any).username ?? (body as any).identifiant ?? "";

  let username = String(usernameRaw ?? "").trim();
  if (!username) {
    username = slugifyUsername(firstName, lastName);
  }

  // email: optionnel (car ton UI n’en envoie pas)
  // Si tu veux l’obliger, remplace la logique en bas.
  const emailRaw = (body as any).email;
  const email = emailRaw ? String(emailRaw).trim().toLowerCase() : "";

  const password = String((body as any).password ?? "");
  const role = normalizeRole((body as any).role);
  const isActive = readBool((body as any).isActive, true);

  if (!username) return badRequest("username requis (ou firstName/lastName)");
  if (!password || password.length < 8) return badRequest("password min 8 caractères");

  // Si email est fourni, validation simple
  if (email) {
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!looksLikeEmail) return badRequest("email invalide");
  }

  // Vérif doublon:
  // - toujours sur username
  // - sur email uniquement si email fourni
  const existing = await prisma.userAccount.findFirst({
    where: {
     OR: [{ username }, { email }],
    },
    select: { id: true },
  });
  if (existing) return json({ error: "username ou email déjà utilisé" }, 409);

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.userAccount.create({
    data: {
      username,
      // n’écrit email que si fourni (sinon null/"" selon ton schéma Prisma)
      email,
      passwordHash,
      role,
      isActive,
    },
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

// DELETE /api/admin/utilisateurs?id=... (ADMIN)
export async function DELETE(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  // ✅ Seul ADMIN
  if (auth.role !== "ADMIN") {
    return json({ error: "Accès refusé (ADMIN requis)." }, 403);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id manquant");

  // ✅ Interdire suppression de soi-même
  if (auth.userId === id) {
    return json({ error: "Impossible de supprimer votre propre compte." }, 400);
  }

  // ✅ Vérifier existence + rôle cible
  const target = await prisma.userAccount.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });

  if (!target) {
    return json({ error: "Utilisateur introuvable." }, 404);
  }

  // ✅ Empêcher suppression si c’est le dernier ADMIN actif
  if (target.role === "ADMIN" && target.isActive) {
    const adminCount = await prisma.userAccount.count({
      where: { role: "ADMIN", isActive: true },
    });

    if (adminCount <= 1) {
      return json(
        { error: "Suppression impossible : c’est le dernier administrateur actif." },
        409
      );
    }
  }

  try {
    // ✅ Suppression réelle en base
    await prisma.userAccount.delete({ where: { id } });
    return json({ ok: true }, 200);
  } catch (e: any) {
    return json(
      { error: e?.message ? `Échec suppression utilisateur : ${e.message}` : "Échec suppression utilisateur." },
      500
    );
  }
}