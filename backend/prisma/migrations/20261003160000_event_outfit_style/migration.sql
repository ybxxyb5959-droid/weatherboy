-- CreateEnum
CREATE TYPE "EventOutfitStyle" AS ENUM ('FORMAL', 'SMART', 'CASUAL', 'COMFORT');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "outfitStyle" "EventOutfitStyle";
