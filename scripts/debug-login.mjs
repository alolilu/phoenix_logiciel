import "dotenv/config";
import bcrypt from "bcryptjs";
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

// 🔧 REMPLIS ICI
const USERNAME = "admin";
const PASSWORD = "tonMotDePasseTesteIci";

async function main() {
  const username = USERNAME.trim();

  const user = await prisma.userAccount.findUnique({
    where: { username },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      isActive: true,
      role: true,
    },
  });

  console.log("USERNAME recherché =", username);
  console.log("USER trouvé =", !!user);

  if (!user) {
    console.log("❌ Aucun user avec ce username en base.");
    return;
  }

  console.log("email =", user.email);
  console.log("isActive =", user.isActive);
  console.log("role =", user.role);
  console.log("passwordHash (début) =", user.passwordHash?.slice(0, 25) + "...");

  const ok = await bcrypt.compare(PASSWORD, user.passwordHash);
  console.log("bcrypt.compare =", ok);

  if (!user.isActive) console.log("❌ Refus car isActive=false");
  if (!ok) console.log("❌ Refus car mot de passe ne correspond pas au hash");
  if (user.isActive && ok) console.log("✅ Login OK (côté bcrypt + DB)");
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