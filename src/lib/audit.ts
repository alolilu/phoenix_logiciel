// src/lib/audit.ts
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { AuditAction, AuditEntityType } from "@prisma/client";

type LogAuditArgs = {
  req?: NextRequest;
  actorUserId?: string | null;
  actorUsername?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  message?: string | null;
  diff?: unknown; // stocké en Json
 before?: string | null;
  after?: string | null;
};
function safeIP(req?: NextRequest) {
  if (!req) return null;
  // selon proxy: x-forwarded-for peut contenir "ip, ip, ..."
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function logAudit(args: LogAuditArgs) {
  const { req, actorUserId, actorUsername, entityType, entityId, action, message, diff } = args;

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        actorUsername: actorUsername ?? null,
        entityType,
        entityId,
        action,
        message: message ?? null,
        diff: diff as any,
        ip: safeIP(req),
        userAgent: req?.headers.get("user-agent") ?? null,
      },
    });
  } catch (e) {
    // On ne bloque jamais l’app si l’audit échoue
    console.error("AUDIT_LOG_FAILED", e);
  }
}
