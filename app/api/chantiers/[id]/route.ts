// app/api/chantiers/[id]/route.ts
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/rbac";

import { logAudit } from "@/lib/audit";
import { AuditAction, AuditEntityType } from "@prisma/client";

/* ======================================================
   Helpers dates
====================================================== */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ✅ IMPORTANT : formatage en UTC (évite décalage France / heure d’été)
function toISODateUTC(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dateOnlyToStartUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dateOnlyToEndUTC(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

/* ======================================================
   Helpers type
====================================================== */

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

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/* ======================================================
   Mapper DB -> UI (UTC FIX)
====================================================== */
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
    type: mapEnumTypeToUILabel(String(item.type)), // ✅ UI label
    title: item.title,
    startDate: startISO,
    endDate: endISO,
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

/* ======================================================
   Next.js params Promise fix
====================================================== */

type Ctx = { params: Promise<{ id: string }> };

/* ======================================================
   PUT
====================================================== */

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await ctx.params;
    const userId = auth.userId;
    const username = null

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    // 🔎 On récupère l'existant pour audit "before"
    const existing = await prisma.jobItem.findUnique({
      where: { id },
      include: { staffLinks: { include: { staff: true } } },
    });

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};

    // title
    if (typeof (body as any).title === "string") {
      const t = String((body as any).title).trim();
      if (!t) return badRequest("Invalid title");
      data.title = t;
    }

    // type
    if ((body as any).type) {
      const rawType = String((body as any).type);
      data.type =
        rawType.includes("_") || rawType === rawType.toUpperCase()
          ? rawType
          : mapUITypeToEnum(rawType);
    }

    // status
    if ((body as any).status) data.status = String((body as any).status);

    // dates (UI ou DB)
    const startDate = (body as any).startDate as string | undefined;
    const endDate = (body as any).endDate as string | undefined;
    const startAtRaw = (body as any).startAt as string | undefined;
    const endAtRaw = (body as any).endAt as string | undefined;

    if (startDate && endDate) {
      data.startAt = dateOnlyToStartUTC(startDate);
      data.endAt = dateOnlyToEndUTC(endDate);
    } else {
      if (startAtRaw) data.startAt = new Date(startAtRaw);
      if (endAtRaw) data.endAt = new Date(endAtRaw);
    }

    // notes
    if (typeof (body as any).notes === "string") {
      data.notes = String((body as any).notes).trim() || null;
    } else if ((body as any).notes === null) {
      data.notes = null;
    }

    // archivage / désarchivage
    if (typeof (body as any).archived === "boolean") {
      const wantArchived = Boolean((body as any).archived);

      if (wantArchived) {
        data.archivedAt = new Date();
        data.archivedById = userId;
        data.archived = true;
      } else {
        data.archivedAt = null;
        data.archivedById = null;
        data.archived = false;
      }
    }

    // intervenants : remplace les liens existants
    if (Array.isArray((body as any).intervenants)) {
      const labels: string[] = (body as any).intervenants;

      await prisma.jobAssignment.deleteMany({ where: { jobId: id } });

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
            ],
          },
          select: { id: true },
        });

        if (!staff) continue;

        await prisma.jobAssignment.create({
          data: { jobId: id, staffId: staff.id },
        });
      }
    }

    const updated = await prisma.jobItem.update({
      where: { id },
      data,
      include: { staffLinks: { include: { staff: true } } },
    });

    // 🧾 AUDIT (UPDATE)
    await logAudit({
      req,
      entityType: AuditEntityType.JOB,
      entityId: id,
      action: AuditAction.UPDATE,
      actorUserId: userId,
      actorUsername: username,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
      message: "Mise à jour chantier",
    });

    const ui = await jobItemToUI(updated);
    return NextResponse.json(ui);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/* ======================================================
   DELETE
====================================================== */

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireWriteAccess(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await ctx.params;
    const userId = auth.userId;
    const username = null

    const existing = await prisma.jobItem.findUnique({
      where: { id },
      include: { staffLinks: { include: { staff: true } } },
    });

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.jobItem.delete({ where: { id } });

    // 🧾 AUDIT (DELETE)
    await logAudit({
      req,
      entityType: AuditEntityType.JOB,
      entityId: id,
      action: AuditAction.DELETE,
      actorUserId: userId,
      actorUsername: username,
      before: JSON.stringify(existing),
      message: "Suppression chantier",
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
