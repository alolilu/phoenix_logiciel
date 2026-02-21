import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __phoenixPrisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL manquant dans .env");
}

// Pool Postgres (réutilisable)
const pool = new Pool({ connectionString });

// Adapter Prisma v7
const adapter = new PrismaPg(pool);

export const phoenixPrisma =
  global.__phoenixPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.__phoenixPrisma = phoenixPrisma;
}
