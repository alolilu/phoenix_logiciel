/*
  Warnings:

  - You are about to drop the column `addressLine1` on the `JobItem` table. All the data in the column will be lost.
  - You are about to drop the column `addressLine2` on the `JobItem` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `JobItem` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `JobItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "JobItem" DROP COLUMN "addressLine1",
DROP COLUMN "addressLine2",
DROP COLUMN "city",
DROP COLUMN "postalCode",
ADD COLUMN     "siteAddress" TEXT;
