/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserAccount` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `UserAccount` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `UserAccount` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserAccount` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `UserAccount` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `UserAccount` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `UserAccount` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `role` on the `UserAccount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "UserAccount_username_key";

-- AlterTable
ALTER TABLE "UserAccount" DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "passwordHash",
DROP COLUMN "updatedAt",
DROP COLUMN "username",
ADD COLUMN     "email" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "StaffRole" NOT NULL;

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
