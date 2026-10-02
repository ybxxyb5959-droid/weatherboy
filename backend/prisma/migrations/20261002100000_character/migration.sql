-- 내 캐릭터 꾸미기(모자/헤어핀/안경 등) 설정
ALTER TABLE "User" ADD COLUMN "characterJson" JSONB NOT NULL DEFAULT '{}';
