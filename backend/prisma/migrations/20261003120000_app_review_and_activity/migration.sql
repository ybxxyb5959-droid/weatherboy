-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "reviewDismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewSnoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewSnoozeUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppReview" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppReview_userId_key" ON "AppReview"("userId");

-- CreateIndex
CREATE INDEX "AppReview_createdAt_idx" ON "AppReview"("createdAt");

-- AddForeignKey
ALTER TABLE "AppReview" ADD CONSTRAINT "AppReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

