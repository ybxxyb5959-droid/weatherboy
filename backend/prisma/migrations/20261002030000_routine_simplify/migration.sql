-- 하루 패턴을 "외출 시간 / 들어오는 시간 / 요일"로 단순화. 출근·등교 구분과 운동 시간은 없앤다.
ALTER TABLE "User" DROP COLUMN "routineKinds", DROP COLUMN "routineExerciseAt";
ALTER TABLE "User" RENAME COLUMN "routineWorkStart" TO "routineOutAt";
ALTER TABLE "User" RENAME COLUMN "routineWorkEnd" TO "routineHomeAt";
