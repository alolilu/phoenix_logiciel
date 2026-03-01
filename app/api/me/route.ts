export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(
    { userId: auth.userId, role: auth.role },
    { status: 200 }
  );
}