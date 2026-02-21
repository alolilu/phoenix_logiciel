/*
  Warnings:

  - The values [ACTIVATE,DEACTIVATE,PASSWORD_RESET,ROLE_CHANGE] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `after` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `before` on the `AuditLog` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'LOGIN', 'LOGOUT');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'ATTACHMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUTH';

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "after",
DROP COLUMN "before",
ADD COLUMN     "diff" JSONB,
ADD COLUMN     "message" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "UserAccount_role_idx" ON "UserAccount"("role");

-- CreateIndex
CREATE INDEX "UserAccount_isActive_idx" ON "UserAccount"("isActive");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
