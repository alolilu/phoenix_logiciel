-- DropIndex
DROP INDEX "JobAttachment_kind_idx";

-- DropIndex
DROP INDEX "JobAttachment_uploadedAt_idx";

-- CreateIndex
CREATE INDEX "JobAttachment_uploadedByUserId_idx" ON "JobAttachment"("uploadedByUserId");
