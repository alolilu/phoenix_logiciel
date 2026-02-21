-- DropIndex
DROP INDEX "JobAttachment_kind_idx";

-- DropIndex
DROP INDEX "JobItem_createdById_idx";

-- DropIndex
DROP INDEX "StaffMember_role_idx";

-- CreateIndex
CREATE INDEX "JobAttachment_uploadedAt_idx" ON "JobAttachment"("uploadedAt");
