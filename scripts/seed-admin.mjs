import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL manquant");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 🔥 IDENTIFIANTS QUE TU VEUX
const USERNAME = "Digitallexs";
const EMAIL = "mazzerdavid@gmail.com";
const PASSWORD = "1234";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // On supprime l'ancien admin si besoin
  await prisma.userAccount.deleteMany({
    where: {
      OR: [
        { username: USERNAME },
        { email: EMAIL },
      ],
    },
  });

  // On recrée proprement
  const user = await prisma.userAccount.create({
    data: {
      username: USERNAME,
      email: EMAIL,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  console.log("✅ Admin recréé :", user);

  const test = await bcrypt.compare(PASSWORD, passwordHash);
  console.log("Test bcrypt =", test);
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });