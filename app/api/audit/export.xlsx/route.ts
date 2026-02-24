export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";

function safeStr(v: unknown) {
  const s = String(v ?? "");
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function excelDate(d: Date) {
  // ExcelJS accepte Date directement
  return d instanceof Date ? d : new Date(d as any);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Phoenix Ops";
    wb.created = new Date();

    const ws = wb.addWorksheet("Audit", {
      views: [{ state: "frozen", ySplit: 1 }], // en-tête figé
    });

    ws.columns = [
      { header: "Date", key: "date", width: 20 },
      { header: "Utilisateur", key: "user", width: 22 },
      { header: "EntityType", key: "entityType", width: 14 },
      { header: "EntityId", key: "entityId", width: 28 },
      { header: "Action", key: "action", width: 14 },
      { header: "Message", key: "message", width: 40 },
      { header: "IP", key: "ip", width: 16 },
      { header: "UserAgent", key: "ua", width: 50 },
    ];

    // Style en-tête
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 18;

    // Ajout des lignes
    for (const l of logs) {
      ws.addRow({
        date: excelDate(l.createdAt),
        user: safeStr(l.actorUsername ?? ""),
        entityType: safeStr(l.entityType),
        entityId: safeStr(l.entityId),
        action: safeStr(l.action),
        message: safeStr(l.message ?? ""),
        ip: safeStr(l.ip ?? ""),
        ua: safeStr(l.userAgent ?? ""),
      });
    }

    // Format date + alignements
    ws.getColumn("date").numFmt = "yyyy-mm-dd hh:mm:ss";
    ws.getColumn("message").alignment = { wrapText: true, vertical: "top" };
    ws.getColumn("ua").alignment = { wrapText: true, vertical: "top" };

    // Auto-filter
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };

    // Bordures légères (optionnel mais rend mieux)
    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
        if (rowNumber === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }, // gris très clair
          };
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="audit_export.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
