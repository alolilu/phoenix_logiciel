import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERNAME = "mazzer.david"; // adapte si besoin
const NEW_PASSWORD = "Mazzerjade26."; // adapte

async function main() {
  console.log("Hash en cours...");

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);

  const user = await prisma.userAccount.update({
    where: { username: USERNAME },
    data: {
      passwordHash: hash,
      isActive: true,
    },
  });

  console.log("Utilisateur mis à jour :", user.username);

  const test = await bcrypt.compare(NEW_PASSWORD, hash);
  console.log("Test bcrypt =", test);

  console.log("✔ Mot de passe enregistré.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });