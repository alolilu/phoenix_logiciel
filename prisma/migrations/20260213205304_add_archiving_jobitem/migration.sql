/*
  Warnings:

  - You are about to drop the `Job` table. If the table is not empty, all the data it contains will be lost.

  NOTE:
  - `UserAccount.email` and the unique index `UserAccount_email_key` are already created in a previous migration
    (20260213195016_fix_missing_inverse_relations). So they must NOT be created again here.
*/

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_archivedById_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_createdById_fkey";

-- AlterTable
ALTER TABLE "JobItem"
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- DropTable
DROP TABLE "Job";

-- CreateIndex
CREATE INDEX "JobItem_archivedAt_idx" ON "JobItem"("archivedAt");

-- CreateIndex
CREATE INDEX "JobItem_archivedById_idx" ON "JobItem"("archivedById");

-- AddForeignKey
ALTER TABLE "JobItem"
ADD CONSTRAINT "JobItem_archivedById_fkey"
FOREIGN KEY ("archivedById") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;