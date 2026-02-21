/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `StaffMember` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserAccount_isActive_idx";

-- DropIndex
DROP INDEX "UserAccount_role_idx";

-- CreateIndex
CREATE INDEX "JobItem_createdById_idx" ON "JobItem"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_email_key" ON "StaffMember"("email");
