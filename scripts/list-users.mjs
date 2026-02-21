import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL manquant dans .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.userAccount.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      isActive: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== USERS EN BASE (UserAccount) ===");
  if (users.length === 0) {
    console.log("Aucun user en base.");
    return;
  }

  for (const u of users) {
    console.log(
      `- id=${u.id} | email=${u.email} | username=${u.username} | active=${u.isActive} | role=${u.role} | createdAt=${u.createdAt.toISOString()}`
    );
  }
}

main()
  .catch((e) => {
    console.error("Erreur script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });