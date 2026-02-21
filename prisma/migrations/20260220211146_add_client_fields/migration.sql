/*
  Warnings:

  - The `role` column on the `UserAccount` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[username]` on the table `UserAccount` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `passwordHash` to the `UserAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UserAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `UserAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "after" TEXT,
ADD COLUMN     "before" TEXT;

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "clientAddress" TEXT,
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "clientPhone" TEXT;

-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");
