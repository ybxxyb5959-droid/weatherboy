-- AlterEnum
ALTER TYPE "EventKind" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "routineDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
ADD COLUMN     "routineExerciseAt" TEXT,
ADD COLUMN     "routineWorkEnd" TEXT,
ADD COLUMN     "routineWorkStart" TEXT;

