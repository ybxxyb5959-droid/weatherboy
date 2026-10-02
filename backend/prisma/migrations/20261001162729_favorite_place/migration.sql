-- CreateTable
CREATE TABLE "FavoritePlace" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "gridNx" INTEGER NOT NULL,
    "gridNy" INTEGER NOT NULL,
    "regionSido" TEXT,
    "regionDistrict" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoritePlace_userId_idx" ON "FavoritePlace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePlace_userId_name_key" ON "FavoritePlace"("userId", "name");

-- AddForeignKey
ALTER TABLE "FavoritePlace" ADD CONSTRAINT "FavoritePlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
