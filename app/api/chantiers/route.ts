// app/api/chantiers/route.ts
export const runtime = "nodejs";

import { logAudit } from "@/lib/audit";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireReadAccess, requireWriteAccess } from "@/lib/rbac";
import crypto from "node:crypto";
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

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addMonthsUTC(d: Date, months: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

function sameOrBefore(a: Date, b: Date) {
  return a.getTime() <= b.getTime();
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
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
  if (k === "nettoyage de bureau" || k === "nettoyage bureau") return "NETTOYAGE_BUREAU";
  if (k === "sinistre incendie") return "SINISTRE_INCENDIE";
  if (k === "degats des eaux") return "DEGATS_DES_EAUX";

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
function mapEnumTypeToUILabel(typeEnum: string) {
  if (typeEnum === "DIOGENE") return "Diogène";
  if (typeEnum === "POST_MORTEM") return "Post-mortem";
  if (typeEnum === "NOE") return "Noé";
  if (typeEnum === "DERATISATION") return "Dératisation";
  if (typeEnum === "DESINSECTISATION") return "Désinsectisation";
  if (typeEnum === "DEBARRAS") return "Débarras";
  if (typeEnum === "OZONE") return "Ozone";
  if (typeEnum === "NEBULISATION") return "Nébulisation";
  if (typeEnum === "SCENE_DE_CRIME") return "Scène de crime";
  if (typeEnum === "DEVIS") return "Devis";
  if (typeEnum === "NETTOYAGE_BUREAU") return "Nettoyage de bureau";
  if (typeEnum === "SINISTRE_INCENDIE") return "Sinistre incendie";
  if (typeEnum === "DEGATS_DES_EAUX") return "Dégâts des eaux";
  return String(typeEnum);
}

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
    type: mapEnumTypeToUILabel(String(item.type)),
    title: item.title,
    startDate: startISO,
    endDate: endISO,
    startTime: item.startTime ?? undefined,
    endTime: item.endTime ?? undefined,
    status: item.status,
    archived: Boolean(item.archivedAt),
    intervenants,
    notes: item.notes ?? undefined,
    recurrenceFrequency: item.recurrenceFrequency ?? "NONE",
    recurrenceEndDate: item.recurrenceEndDate ? toISODateUTC(new Date(item.recurrenceEndDate)) : null,
    isRecurringTemplate: Boolean(item.isRecurringTemplate),
    recurrenceGroupId: item.recurrenceGroupId ?? null,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

/** =========================================================
 * GET /api/chantiers?archived=true|false
 * ========================================================= */

export async function GET(req: NextRequest) {
  try {
    const auth = await requireReadAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const session = await getServerSession(authOptions);
    if (!session) {
      const dbUser = await getDbUserFromSession(session);
      if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!dbUser.isActive) return NextResponse.json({ error: "User disabled" }, { status: 403 });
      // pas de check role ici => ADMIN + USER peuvent lire
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const archived = parseArchived(req);

    const where: any = {
      isRecurringTemplate: false,
    };
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
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    const startTime = (body as any).startTime || "00:00";
    const endTime = (body as any).endTime || "00:00";
    const startAtRaw = (body as any).startAt;
    const endAtRaw = (body as any).endAt;

    let startAt: Date;
    let endAt: Date;

    if (startDate && endDate) {
      startAt = new Date(`${startDate}T${startTime}:00`);
      endAt = new Date(`${endDate}T${endTime}:00`);
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

    const recurrenceFrequency = String((body as any).recurrenceFrequency ?? "NONE").toUpperCase();
    const recurrenceEndDateRaw = (body as any).recurrenceEndDate
      ? String((body as any).recurrenceEndDate)
      : null;

    // intervenants labels reçus du front
    const intervenantLabels: string[] = Array.isArray((body as any).intervenants)
      ? (body as any).intervenants
      : [];

    async function attachIntervenants(jobId: string, labels: string[]) {
      for (const label of labels) {
        const trimmed = String(label ?? "").trim();
        if (!trimmed) continue;

        const parts = trimmed.split(" ").filter(Boolean);
        const lastName = parts.length >= 2 ? parts[parts.length - 1] : trimmed;
        const firstName = parts.length >= 2 ? parts.slice(0, -1).join(" ") : "";

        const staff = await prisma.staffMember.findFirst({
          where: {
            AND: [
              firstName ? { firstName: { equals: firstName, mode: "insensitive" } } : {},
              { lastName: { equals: lastName, mode: "insensitive" } },
              { isActive: true },
            ],
          },
          select: { id: true },
        });

        if (!staff) continue;

        await prisma.jobAssignment.create({
          data: { jobId, staffId: staff.id },
        });
      }
    }

    // ✅ Cas standard non récurrent
    if (recurrenceFrequency === "NONE") {
      const created = await prisma.jobItem.create({
        data: {
          title,
          type: typeEnum as any,
          status: status as any,
          startAt,
          endAt,
          startTime: startTime,
          endTime: endTime,
          notes,
          createdById: dbUser.id,
          archivedAt: null,
          archivedById: null,
          archived: false,
          recurrenceFrequency: "NONE",
          recurrenceInterval: 0,
          recurrenceDayOfWeek: null,
          recurrenceStartDate: null,
          recurrenceEndDate: null,
          recurrenceGroupId: null,
          isRecurringTemplate: false,
        },
        include: { staffLinks: { include: { staff: true } } },
      });

      await attachIntervenants(created.id, intervenantLabels);

      const createdWithLinks = await prisma.jobItem.findUniqueOrThrow({
        where: { id: created.id },
        include: { staffLinks: { include: { staff: true } } },
      });

      await logAudit({
        req,
        actorUserId: dbUser.id,
        actorUsername: dbUser.username,
        entityType: AuditEntityType.JOB,
        entityId: created.id,
        action: AuditAction.CREATE,
        message: "Création chantier",
      });

      const ui = await jobItemToUI(createdWithLinks);
      return NextResponse.json(ui, { status: 201 });
    }

    // ✅ Cas récurrent (nettoyage de bureau)
    if (typeEnum !== "NETTOYAGE_BUREAU") {
      return badRequest("La récurrence est réservée au type Nettoyage de bureau.");
    }

    if (!recurrenceEndDateRaw) {
      return badRequest("recurrenceEndDate manquante pour un chantier récurrent.");
    }

    const recurrenceStartDate = startOfUtcDay(startAt);
    const recurrenceEndDate = endOfUtcDay(dateOnlyToStartUTC(recurrenceEndDateRaw));

    if (!sameOrBefore(recurrenceStartDate, recurrenceEndDate)) {
      return badRequest("recurrenceEndDate doit être >= startDate.");
    }

    const durationMs = endAt.getTime() - startAt.getTime();
    const recurrenceGroupId = crypto.randomUUID();

    // 1) créer le template
    const template = await prisma.jobItem.create({
      data: {
        title,
        type: typeEnum as any,
        status: status as any,
        startAt,
        endAt,
        startTime: startTime,
        endTime: endTime,
        notes,
        createdById: dbUser.id,
        archivedAt: null,
        archivedById: null,
        archived: false,
        recurrenceFrequency: recurrenceFrequency as any,
        recurrenceInterval: recurrenceFrequency === "BIWEEKLY" ? 14 : recurrenceFrequency === "WEEKLY" ? 7 : 1,
        recurrenceDayOfWeek: startAt.getUTCDay(),
        recurrenceStartDate,
        recurrenceEndDate,
        recurrenceGroupId,
        isRecurringTemplate: true,
      },
      include: { staffLinks: { include: { staff: true } } },
    });

    await attachIntervenants(template.id, intervenantLabels);

    // 2) générer les occurrences
    const createdOccurrences: string[] = [];
    let cursorStart = new Date(startAt);

    while (sameOrBefore(startOfUtcDay(cursorStart), recurrenceEndDate)) {
      const cursorEnd = new Date(cursorStart.getTime() + durationMs);

      const occurrence = await prisma.jobItem.create({
        data: {
          title,
          type: typeEnum as any,
          status: status as any,
          startAt: cursorStart,
          endAt: cursorEnd,
          startTime: startTime,
          endTime: endTime, 
          notes,
          createdById: dbUser.id,
          archivedAt: null,
          archivedById: null,
          archived: false,
          recurrenceFrequency: recurrenceFrequency as any,
          recurrenceInterval: recurrenceFrequency === "BIWEEKLY" ? 14 : recurrenceFrequency === "WEEKLY" ? 7 : 1,
          recurrenceDayOfWeek: cursorStart.getUTCDay(),
          recurrenceStartDate,
          recurrenceEndDate,
          recurrenceGroupId,
          isRecurringTemplate: false,
        },
      });

      await attachIntervenants(occurrence.id, intervenantLabels);
      createdOccurrences.push(occurrence.id);

      if (recurrenceFrequency === "WEEKLY") {
        cursorStart = addDaysUTC(cursorStart, 7);
      } else if (recurrenceFrequency === "BIWEEKLY") {
        cursorStart = addDaysUTC(cursorStart, 14);
      } else if (recurrenceFrequency === "MONTHLY") {
        cursorStart = addMonthsUTC(cursorStart, 1);
      } else {
        break;
      }
    }

    await logAudit({
      req,
      actorUserId: dbUser.id,
      actorUsername: dbUser.username,
      entityType: AuditEntityType.JOB,
      entityId: template.id,
      action: AuditAction.CREATE,
      message: `Création chantier récurrent (${createdOccurrences.length} occurrence(s))`,
    });

    const templateWithLinks = await prisma.jobItem.findUniqueOrThrow({
      where: { id: template.id },
      include: { staffLinks: { include: { staff: true } } },
    });

    const ui = await jobItemToUI(templateWithLinks);
    return NextResponse.json(ui, { status: 201 });

  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
