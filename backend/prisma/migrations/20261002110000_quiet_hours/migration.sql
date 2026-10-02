-- 방해금지 시간: 사용자가 정한다(기본 23:00~07:00). 이 시간에는 푸시를 보내지 않는다.
ALTER TABLE "User" ADD COLUMN "quietEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "quietStart" TEXT NOT NULL DEFAULT '23:00';
ALTER TABLE "User" ADD COLUMN "quietEnd" TEXT NOT NULL DEFAULT '07:00';
