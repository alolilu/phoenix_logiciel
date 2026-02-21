-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
