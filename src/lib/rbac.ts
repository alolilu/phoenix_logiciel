import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export type PhoenixRole = "ADMIN" | "USER";

export type AuthResult =
  | { ok: true; role: PhoenixRole; userId: string; token: any }
  | { ok: false; status: 401 | 403; error: "UNAUTHORIZED" | "FORBIDDEN" };

  export async function requireReadAccess(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  // ADMIN ou USER => OK
  if (auth.role !== "ADMIN" && auth.role !== "USER") {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }
  return auth;
}
function readRoleFromToken(token: any): PhoenixRole | null {
  const r = token?.role ?? token?.user?.role ?? null;
  if (r === "ADMIN" || r === "USER") return r;
  return null;
}

function readUserIdFromToken(token: any): string | null {
  // Priorité à userId si tu l’ajoutes dans callback jwt
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

  return { ok: true, role, userId, token };
}

export async function requireWriteAccess(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (auth.role !== "ADMIN") return { ok: false, status: 403, error: "FORBIDDEN" };
  return auth;
}
