-- 예시 옷(온보딩에서 자동 생성)을 사용자가 직접 등록한 옷과 구분한다. 기존 행은 모두 false.
ALTER TABLE "Clothing" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
