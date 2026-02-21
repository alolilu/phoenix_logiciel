import "dotenv/config";
import bcrypt from "bcryptjs";
import { phoenixPrisma } from "../src/phoenix-auth-db/PhoenixPrismaClient";

async function main() {
  // ⚠️ identifiants init (tu pourras les changer après)
  const adminUsername = "david.mazzer";
  const adminPassword = "Mazzer26.";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // ⚠️ le nom du modèle dépend de ton schema Prisma.
  // Sur ta capture Prisma Studio, tu as "Compte utilisateur".
  // Dans Prisma, ça devient souvent "userAccount" OU "compteUtilisateur".
  // On va gérer les deux cas simplement en essayant d'abord "userAccount".
  const anyPrisma = phoenixPrisma as any;

  const model =
    anyPrisma.userAccount ??
    anyPrisma.compteUtilisateur ??
    anyPrisma.compte_utilisateur ??
    null;

  if (!model) {
    throw new Error(
    );
  }

  const existing = await model.findUnique({
    where: { username: adminUsername },
  });

  if (existing) {
    console.log("ADMIN existe déjà :", adminUsername);
    return;
  }

  await model.create({
    data: {
      username: adminUsername,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("ADMIN créé ✅");
  console.log("username =", adminUsername);
  console.log("password =", adminPassword);
}

main()
  .catch((e) => {
    console.error("ERREUR seed admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await phoenixPrisma.$disconnect();
  });
