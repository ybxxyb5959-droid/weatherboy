-- AlterTable
ALTER TABLE "User" ADD COLUMN     "routineKinds" TEXT[] DEFAULT ARRAY[]::TEXT[];

