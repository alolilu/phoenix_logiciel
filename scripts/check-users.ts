import { prisma } from "@/src/lib/prisma";

async function main() {
  const users = await prisma.userAccount.findMany({
    select: { id: true, username: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: "desc" as any },
  });

  console.log("UserAccount count:", users.length);
  console.table(users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
