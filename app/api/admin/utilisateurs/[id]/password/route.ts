export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../../../src/lib/prisma"; 
// Note : Pas d'accolades autour de prisma car c'est un export default

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params; // ✅ Next 16.1.1 attend params en Promise

    const { password } = await req.json();
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.userAccount.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    });

    return NextResponse.json({ message: "Mot de passe mis à jour" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}