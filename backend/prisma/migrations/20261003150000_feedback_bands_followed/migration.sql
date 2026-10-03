-- AlterTable
ALTER TABLE "User" ADD COLUMN "feedbackBandsJson" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "followed" BOOLEAN NOT NULL DEFAULT true;

-- 지금까지 쌓인 하나의 보정값을 세 기온대에 똑같이 나눠 담는다
UPDATE "User" SET "feedbackBandsJson" = jsonb_build_object('low', "feedbackOffset", 'mid', "feedbackOffset", 'high', "feedbackOffset") WHERE "feedbackOffset" <> 0;
