/*
  Warnings:

  - The values [ARCHIVE] on the enum `JobStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "JobStatus_new" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE');
ALTER TABLE "public"."JobItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "JobItem" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "public"."JobStatus_old";
ALTER TABLE "JobItem" ALTER COLUMN "status" SET DEFAULT 'EN_ATTENTE';
COMMIT;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "StaffMember_isActive_idx" ON "StaffMember"("isActive");
