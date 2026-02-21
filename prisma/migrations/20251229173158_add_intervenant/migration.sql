-- CreateTable
CREATE TABLE "Intervenant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,

    CONSTRAINT "Intervenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Intervenant_isActive_idx" ON "Intervenant"("isActive");

-- CreateIndex
CREATE INDEX "Intervenant_fullName_idx" ON "Intervenant"("fullName");

-- AddForeignKey
ALTER TABLE "Intervenant" ADD CONSTRAINT "Intervenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
