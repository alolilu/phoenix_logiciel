// app/api/chantiers/route.ts
export const runtime = "nodejs";

import { logAudit } from "@/src/lib/audit";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";

/** ========= Helpers dates ========= */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ✅ Format UTC strict (évite décalage France / heure d’été)
function toISODateUTC(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dateOnlyToStartUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dateOnlyToEndUTC(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

/** ========= Helpers type ========= */

function normalizeType(type: string) {
  return (type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace("post mortem", "post-mortem");
}

function mapUITypeToEnum(typeLabel: string) {
  const k = normalizeType(typeLabel);

  if (k === "diogene") return "DIOGENE";
  if (k === "post-mortem") return "POST_MORTEM";
  if (k === "noe") return "NOE";
  if (k === "deratisation") return "DERATISATION";
  if (k === "desinsectisation") return "DESINSECTISATION";
  if (k === "debarras") return "DEBARRAS";
  if (k === "ozone") return "OZONE";
  if (k === "nebulisation") return "NEBULISATION";
  if (k === "scene de crime") return "SCENE_DE_CRIME";
  if (k === "devis") return "DEVIS";

  return "DEVIS";
}

/** ========= Query param archived ========= */

function parseArchived(req: NextRequest): boolean | null {
  const v = req.nextUrl.searchParams.get("archived");
  if (v === null) return null;

  const s = v.trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;

  return null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** ========= Auth helper ========= */

async function getDbUserFromSession(session: any) {
  const sessionUserId = (session as any)?.userId ?? (session as any)?.user?.id ?? null;
  const sessionUsername = (session as any)?.user?.name ?? (session as any)?.name ?? null;

  if (sessionUserId) {
    const u = await prisma.userAccount.findUnique({
      where: { id: String(sessionUserId) },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (u) return u;
  }

  if (sessionUsername) {
    const u = await prisma.userAccount.findUnique({
      where: { username: String(sessionUsername) },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (u) return u;
  }

  return null;
}

/** ========= Mapper DB -> UI ========= */

async function jobItemToUI(item: any) {
  const startISO = toISODateUTC(new Date(item.startAt));
  const endISO = toISODateUTC(new Date(item.endAt));

  const intervenants: string[] =
    item.staffLinks?.map((l: any) => {
      const s = l.staff;
      const full = `${s?.firstName ?? ""} ${s?.lastName ?? ""}`.trim();
      return full || String(s?.id ?? "");
    }) ?? [];

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    startDate: startISO,
    endDate: endISO,
    status: item.status,
    archived: Boolean(item.archivedAt),
    intervenants,
    notes: item.notes ?? undefined,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

/** =========================================================
 * GET /api/chantiers?archived=true|false
 * ========================================================= */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const archived = parseArchived(req);

    const where: any = {};
    if (archived === true) where.archivedAt = { not: null };
    if (archived === false) where.archivedAt = null;

    const items = await prisma.jobItem.findMany({
      where,
      orderBy: { startAt: "desc" },
      include: { staffLinks: { include: { staff: true } } },
    });

    const ui = [];
    for (const it of items) {
      ui.push(await jobItemToUI(it));
    }

    return NextResponse.json(ui);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

/** =========================================================
 * POST /api/chantiers
 * ADMIN ONLY
 * ========================================================= */

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getDbUserFromSession(session);
    if (!dbUser) {
      return NextResponse.json(
        {
          error:
            "User not found in DB for current session (createdById FK would fail).",
        },
        { status: 401 }
      );
    }

    if (!dbUser.isActive) {
      return NextResponse.json({ error: "User disabled" }, { status: 403 });
    }

    if (String(dbUser.role) !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return badRequest("Invalid JSON body");
    }

    const title = String((body as any).title ?? "").trim();
    if (!title) return badRequest("Missing title");

    const status = String((body as any).status ?? "EN_ATTENTE");

    const rawType = (body as any).type;
    if (!rawType) return badRequest("Missing type");

    const rawTypeStr = String(rawType);
    const typeEnum =
      rawTypeStr.includes("_") || rawTypeStr === rawTypeStr.toUpperCase()
        ? rawTypeStr
        : mapUITypeToEnum(rawTypeStr);

    const startDate = (body as any).startDate;
    const endDate = (body as any).endDate;
    const startAtRaw = (body as any).startAt;
    const endAtRaw = (body as any).endAt;

    let startAt: Date;
    let endAt: Date;

    if (startDate && endDate) {
      startAt = dateOnlyToStartUTC(startDate);
      endAt = dateOnlyToEndUTC(endDate);
    } else if (startAtRaw && endAtRaw) {
      startAt = new Date(startAtRaw);
      endAt = new Date(endAtRaw);
    } else {
      return badRequest("Missing startDate/endDate");
    }

    if (Number.isNaN(startAt.getTime())) return badRequest("Invalid start date");
    if (Number.isNaN(endAt.getTime())) return badRequest("Invalid end date");

    const notes = (body as any).notes ?? null;
    const intervenants = Array.isArray((body as any).intervenants)
      ? (body as any).intervenants
      : [];

    const created = await prisma.jobItem.create({
      data: {
        title,
        type: typeEnum as any,
        status: status as any,
        startAt,
        endAt,
        notes,
        createdById: dbUser.id,
        archivedAt: null,
        archivedById: null,
        archived: false,
      },
      include: { staffLinks: { include: { staff: true } } },
    });

    // ✅ LOG AUDIT CREATE
    await logAudit({
      req,
      actorUserId: dbUser.id,
      actorUsername: dbUser.username,
      entityType: AuditEntityType.JOB,
      entityId: created.id,
      action: AuditAction.CREATE,
      message: "Création chantier",
    });

    const ui = await jobItemToUI(created);
    return NextResponse.json(ui, { status: 201 });

  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
