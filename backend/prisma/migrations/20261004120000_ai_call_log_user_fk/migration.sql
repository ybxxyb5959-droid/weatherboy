-- 탈퇴한 사용자의 userId 가 AI 호출 기록에 남지 않도록 FK(ON DELETE SET NULL)를 건다.
-- 지금까지 남은, 이미 없는 사용자를 가리키는 값은 FK 를 걸기 전에 비운다(호출 기록 자체는 유지).
UPDATE "AiCallLog" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "User");

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
