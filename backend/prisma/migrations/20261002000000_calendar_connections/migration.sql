-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "calendarConnectionId" UUID,
ADD COLUMN     "externalUid" TEXT;

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "icalUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarConnection_userId_idx" ON "CalendarConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_icalUrl_key" ON "CalendarConnection"("userId", "icalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Event_calendarConnectionId_externalUid_key" ON "Event"("calendarConnectionId", "externalUid");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarConnectionId_fkey" FOREIGN KEY ("calendarConnectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

