-- 푸시 종류별 설정 + 같은 알림이 하루에 두 번 가지 않게 하는 중복 방지 키
ALTER TABLE "User"
  ADD COLUMN "notifyMorning"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyRain"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyColdReturn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyDust"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifyFeedback"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyCloset"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifyNotice"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "morningLeadMin"   INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "NotifyLog"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'EVENT',
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "NotifyLog_userId_dedupeKey_key" ON "NotifyLog"("userId", "dedupeKey");
