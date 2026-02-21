-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('GERANT', 'TECHNICIEN', 'PRESTATAIRE');

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'TECHNICIEN';

-- CreateIndex
CREATE INDEX "StaffMember_role_idx" ON "StaffMember"("role");
