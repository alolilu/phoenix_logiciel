export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2]; // .../intervenants/[id]/purge
  return id ? String(id) : null;
}

export async function DELETE(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (auth.role !== "ADMIN") {
    return json({ error: "Accès refusé (ADMIN requis)." }, 403);
  }

  const id = getIdFromUrl(req);
  if (!id) return json({ error: "ID manquant" }, 400);

  // ✅ Sécurité : on n’autorise la purge QUE si déjà inactif
  const existing = await prisma.staffMember.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!existing) return json({ error: "Intervenant introuvable." }, 404);

  if (existing.isActive) {
    return json(
      { error: "Purge refusée : désactive d’abord l’intervenant (Inactif), puis purge." },
      409
    );
  }

  try {
    await prisma.staffMember.delete({ where: { id } });
    return json({ ok: true }, 200);
  } catch (e: any) {
    // Prisma FK violation souvent = P2003
    const code = e?.code ? String(e.code) : "";
    if (code === "P2003") {
      return json(
        { error: "Suppression impossible : cet intervenant est lié à des données (historique). Laisse-le Inactif." },
        409
      );
    }
    return json(
      { error: e?.message ? `Erreur purge intervenant : ${e.message}` : "Erreur purge intervenant." },
      500
    );
  }
}