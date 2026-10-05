-- 일정마다 옷차림 추천이 필요한지(기본 필요). 끄면(기타 종류는 항상) 그날 날씨만 알려준다.
ALTER TABLE "Event" ADD COLUMN "needsOutfit" BOOLEAN NOT NULL DEFAULT true;
