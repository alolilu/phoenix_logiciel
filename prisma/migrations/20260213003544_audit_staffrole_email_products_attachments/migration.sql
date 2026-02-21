-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "UserAccount_role_idx" ON "UserAccount"("role");

-- CreateIndex
CREATE INDEX "UserAccount_isActive_idx" ON "UserAccount"("isActive");
