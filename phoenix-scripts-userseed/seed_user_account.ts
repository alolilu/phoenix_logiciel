import "dotenv/config";
import bcrypt from "bcryptjs";
import { phoenixPrisma } from "../src/phoenix-auth-db/PhoenixPrismaClient";
import { PhoenixRoles } from "../src/phoenix-auth-core/PhoenixRoleCatalog";

async function main() {
  const username = "user_phoenix";
  const password = "ChangeMoiUser!2025";

  const passwordHash = await bcrypt.hash(password, 12);

  const anyPrisma = phoenixPrisma as any;
  const model =
    anyPrisma.userAccount ??
    anyPrisma.compteUtilisateur ??
    anyPrisma.compte_utilisateur ??
    null;

  if (!model) {
    throw new Error("Modèle utilisateur Prisma introuvable (userAccount/compteUtilisateur).");
  }

  const existing = await model.findUnique({ where: { username } });

  if (existing) {
    console.log("USER existe déjà :", username);
    return;
  }

  await model.create({
    data: {
      username,
      passwordHash,
      role: PhoenixRoles.USER,
      isActive: true,
    },
  });

  console.log("USER créé ✅");
  console.log("username =", username);
  console.log("password =", password);
}

main()
  .catch((e) => {
    console.error("ERREUR seed user:", e);
    process.exit(1);
  })
  .finally(async () => {
    await phoenixPrisma.$disconnect();
  });
