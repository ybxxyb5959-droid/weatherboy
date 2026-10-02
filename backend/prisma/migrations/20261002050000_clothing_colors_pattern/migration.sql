-- 옷 색을 늘리고(남색·하늘색·갈색·카키·빨강·분홍·주황·노랑·보라) 무늬(무지/체크/줄무늬/도트/프린트)를 저장한다.
ALTER TYPE "ClothingColor" ADD VALUE 'NAVY';
ALTER TYPE "ClothingColor" ADD VALUE 'SKYBLUE';
ALTER TYPE "ClothingColor" ADD VALUE 'BROWN';
ALTER TYPE "ClothingColor" ADD VALUE 'KHAKI';
ALTER TYPE "ClothingColor" ADD VALUE 'RED';
ALTER TYPE "ClothingColor" ADD VALUE 'PINK';
ALTER TYPE "ClothingColor" ADD VALUE 'ORANGE';
ALTER TYPE "ClothingColor" ADD VALUE 'YELLOW';
ALTER TYPE "ClothingColor" ADD VALUE 'PURPLE';
CREATE TYPE "ClothingPattern" AS ENUM ('SOLID', 'CHECK', 'STRIPE', 'DOT', 'PRINT');
ALTER TABLE "Clothing" ADD COLUMN "pattern" "ClothingPattern" NOT NULL DEFAULT 'SOLID';
