import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const IDENT = process.env.RESET_IDENT; // username OU email
const PASS = process.env.RESET_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!IDENT || !PASS) { console.error("Missing RESET_IDENT or RESET_PASSWORD"); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.userAccount.findFirst({
    where: { OR: [{ username: IDENT }, { email: IDENT }] },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });

  if (!user) {
    console.error("User not found for:", IDENT);
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(PASS, 10);

  const updated = await prisma.userAccount.update({
    where: { id: user.id },
    data: { passwordHash, isActive: true, role: "ADMIN" },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });

  console.log("OK updated:", updated);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });