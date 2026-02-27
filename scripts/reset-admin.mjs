import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const USER = process.env.RESET_USER;
const PASS = process.env.RESET_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL (check .env.local)");
  process.exit(1);
}
if (!USER || !PASS) {
  console.error("Missing RESET_USER or RESET_PASSWORD");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(PASS, 10);

  const existing = await prisma.userAccount.findUnique({
    where: { username: USER },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!existing) {
    console.error("User not found:", USER);
    process.exit(2);
  }

  const updated = await prisma.userAccount.update({
    where: { username: USER },
    data: { passwordHash, isActive: true, role: "ADMIN" },
    select: { id: true, username: true, role: true, isActive: true },
  });

  console.log("OK updated:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });