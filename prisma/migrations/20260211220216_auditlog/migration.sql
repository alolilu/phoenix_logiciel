-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('PHOTO', 'DOCUMENT');

-- DropIndex
DROP INDEX "UserAccount_isActive_idx";

-- DropIndex
DROP INDEX "UserAccount_role_idx";

-- AlterTable
ALTER TABLE "JobAttachment" ADD COLUMN     "kind" "AttachmentKind" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN     "uploadedByUserId" TEXT;

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "postalCode" TEXT;

-- CreateTable
CREATE TABLE "JobProductUsed" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobProductUsed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobProductUsed_jobId_idx" ON "JobProductUsed"("jobId");

-- CreateIndex
CREATE INDEX "JobProductUsed_createdAt_idx" ON "JobProductUsed"("createdAt");

-- CreateIndex
CREATE INDEX "JobAttachment_kind_idx" ON "JobAttachment"("kind");

-- CreateIndex
CREATE INDEX "JobAttachment_uploadedAt_idx" ON "JobAttachment"("uploadedAt");

-- AddForeignKey
ALTER TABLE "JobProductUsed" ADD CONSTRAINT "JobProductUsed_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
