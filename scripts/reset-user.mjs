import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const username = process.env.RESET_USER;
  const passwordHash = process.env.RESET_HASH;

  if (!username || !passwordHash) {
    throw new Error("Missing RESET_USER or RESET_HASH");
  }

  const u = await prisma.userAccount.update({
    where: { username },
    data: { passwordHash, isActive: true },
    select: { id: true, username: true, isActive: true, role: true },
  });

  console.log("OK updated:", u);
}

main()
  .catch((e) => {
    console.error("ERR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });