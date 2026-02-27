import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type PhoenixRole = "ADMIN" | "USER";

export type AuthResult =
  | { ok: true; role: PhoenixRole; userId: string; token: any }
  | { ok: false; status: 401 | 403; error: "UNAUTHORIZED" | "FORBIDDEN" };

function readRoleFromToken(token: any): PhoenixRole | null {
  const r = token?.role ?? token?.user?.role ?? null;
  if (r === "ADMIN" || r === "USER") return r;
  return null;
}

function readUserIdFromToken(token: any): string | null {
  const uid =
    token?.userId ??
    token?.uid ??
    token?.id ??
    token?.user?.id ??
    token?.sub ??
    null;

  const s = typeof uid === "string" ? uid.trim() : "";
  return s ? s : null;
}

/**
 * Auth de base :
 * - token présent
 * - role valide
 * - userId valide
 * - utilisateur existe en DB et isActive=true
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const role = readRoleFromToken(token);
  if (!role) return { ok: false, status: 403, error: "FORBIDDEN" };

  const userId = readUserIdFromToken(token);
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  // 🔒 Blocage global si compte désactivé (ou supprimé)
  const dbUser = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, role, userId, token };
}

/**
 * Lecture (ADMIN ou USER)
 */
export async function requireReadAccess(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  return auth;
}

/**
 * Écriture (ADMIN only)
 */
export async function requireWriteAccess(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (auth.role !== "ADMIN") return { ok: false, status: 403, error: "FORBIDDEN" };
  return auth;
}