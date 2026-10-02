-- 출근·등교/운동·산책은 이제 일정이 아니라 하루 패턴으로 다룬다. 기존 일정은 '기타'로 옮긴다.
-- (새 enum 값은 추가한 트랜잭션 안에서 쓸 수 없어서 별도 마이그레이션으로 분리)
UPDATE "Event" SET "kind" = 'OTHER' WHERE "kind" IN ('COMMUTE', 'EXERCISE');
