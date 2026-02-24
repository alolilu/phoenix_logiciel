import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

async function main() {
  const username = "david.mazzer";
  const email = "mazzerdavid@gmail.com";
  const plain = "Mazzerjade26.";

  const passwordHash = await hashPassword(plain);

  const admin = await prisma.userAccount.upsert({
    where: { username },
    create: {
      username,
      email,
      passwordHash,
      role: "ADMIN" as any,
      isActive: true,
    },
    update: {
      email,
      passwordHash,
      role: "ADMIN" as any,
      isActive: true,
    },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  });

  console.log("✅ ADMIN prêt :", admin);
  console.log("🔑 Mot de passe temporaire :", plain);
}

main()
  .catch((e) => {
    console.error("❌ reset-admin error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
