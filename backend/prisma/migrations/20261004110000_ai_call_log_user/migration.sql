-- AlterTable: 누가(userId) 어떤 종류(kind: photo/text)로 AI 를 불렀는지 남긴다. 예전 기록은 둘 다 비어 있다.
ALTER TABLE "AiCallLog" ADD COLUMN "userId" UUID;
ALTER TABLE "AiCallLog" ADD COLUMN "kind" TEXT;

-- CreateIndex: 사용자별 최근 24시간 호출 수를 세는 데 쓴다
CREATE INDEX "AiCallLog_userId_kind_createdAt_idx" ON "AiCallLog"("userId", "kind", "createdAt");
