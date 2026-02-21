/*
  Warnings:

  - You are about to drop the `Chantier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Intervenant` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'DEVIS';

-- DropForeignKey
ALTER TABLE "Intervenant" DROP CONSTRAINT "Intervenant_createdById_fkey";

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Chantier";

-- DropTable
DROP TABLE "Intervenant";

-- CreateIndex
CREATE INDEX "JobAssignment_jobId_idx" ON "JobAssignment"("jobId");

-- CreateIndex
CREATE INDEX "JobAssignment_staffId_idx" ON "JobAssignment"("staffId");

-- CreateIndex
CREATE INDEX "JobAttachment_jobId_idx" ON "JobAttachment"("jobId");

-- CreateIndex
CREATE INDEX "JobItem_startAt_idx" ON "JobItem"("startAt");

-- CreateIndex
CREATE INDEX "JobItem_endAt_idx" ON "JobItem"("endAt");

-- CreateIndex
CREATE INDEX "JobItem_status_idx" ON "JobItem"("status");

-- CreateIndex
CREATE INDEX "JobItem_archived_idx" ON "JobItem"("archived");

-- CreateIndex
CREATE INDEX "StaffMember_lastName_idx" ON "StaffMember"("lastName");
