-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('KAKAO', 'GUEST');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('COLD', 'NORMAL', 'HOT');

-- CreateEnum
CREATE TYPE "ClothingType" AS ENUM ('SHORT_SLEEVE', 'LONG_SLEEVE', 'SWEATSHIRT', 'KNIT', 'HOODIE', 'PANTS', 'SHORTS', 'SKIRT', 'WINDBREAKER', 'JACKET', 'COAT', 'PADDING');

-- CreateEnum
CREATE TYPE "Thickness" AS ENUM ('THIN', 'NORMAL', 'THICK');

-- CreateEnum
CREATE TYPE "ClothingColor" AS ENUM ('BLACK', 'GRAY', 'WHITE', 'BEIGE', 'GREEN', 'BLUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ClothingCategory" AS ENUM ('TOP', 'BOTTOM', 'LIGHT_OUTER', 'HEAVY_OUTER');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('TRAVEL', 'CAMPING', 'COMMUTE', 'EXERCISE');

-- CreateEnum
CREATE TYPE "ForecastStage" AS ENUM ('WAITING', 'MIDTERM', 'SHORTTERM');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('COLD', 'OK', 'HOT');

-- CreateEnum
CREATE TYPE "FeedbackPeriod" AS ENUM ('MORNING', 'DAY', 'EVENING');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotifyStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "Sensitivity" NOT NULL DEFAULT 'NORMAL',
    "feedbackOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locationName" TEXT NOT NULL DEFAULT '서울 마포구',
    "regionSido" TEXT,
    "regionDistrict" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gridNx" INTEGER,
    "gridNy" INTEGER,
    "notifyEvent" BOOLEAN NOT NULL DEFAULT true,
    "notifyChange" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "nickname" TEXT,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clothing" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ClothingType" NOT NULL,
    "thickness" "Thickness" NOT NULL,
    "color" "ClothingColor" NOT NULL,
    "category" "ClothingCategory" NOT NULL,
    "warmth" DOUBLE PRECISION NOT NULL,
    "windproof" BOOLEAN NOT NULL DEFAULT false,
    "waterproof" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clothing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "placeName" TEXT NOT NULL DEFAULT '',
    "regionSido" TEXT,
    "regionDistrict" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gridNx" INTEGER,
    "gridNy" INTEGER,
    "forecastStage" "ForecastStage" NOT NULL DEFAULT 'WAITING',
    "recommendationVersion" INTEGER NOT NULL DEFAULT 0,
    "lastDecisionKey" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "id" UUID NOT NULL,
    "gridNx" INTEGER NOT NULL,
    "gridNy" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetAt" TIMESTAMP(3) NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "feelsLike" DOUBLE PRECISION,
    "tempMin" DOUBLE PRECISION,
    "tempMax" DOUBLE PRECISION,
    "precipitationProbability" INTEGER,
    "precipitationType" TEXT,
    "windSpeed" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "sky" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirQuality" (
    "id" UUID NOT NULL,
    "region" TEXT NOT NULL,
    "stationName" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pm10" INTEGER,
    "pm25" INTEGER,
    "pm10Grade" INTEGER,
    "pm25Grade" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID,
    "targetStartAt" TIMESTAMP(3) NOT NULL,
    "targetEndAt" TIMESTAMP(3) NOT NULL,
    "resultJson" JSONB NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "decisionKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aiExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recommendationId" UUID NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "period" "FeedbackPeriod",
    "actualTemperature" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectLog" (
    "id" UUID NOT NULL,
    "job" TEXT NOT NULL,
    "target" TEXT,
    "status" "LogStatus" NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotifyLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID,
    "status" "NotifyStatus" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotifyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "Clothing_userId_active_idx" ON "Clothing"("userId", "active");

-- CreateIndex
CREATE INDEX "Event_userId_startAt_idx" ON "Event"("userId", "startAt");

-- CreateIndex
CREATE INDEX "Event_forecastStage_startAt_idx" ON "Event"("forecastStage", "startAt");

-- CreateIndex
CREATE INDEX "ForecastSnapshot_gridNx_gridNy_targetAt_idx" ON "ForecastSnapshot"("gridNx", "gridNy", "targetAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastSnapshot_gridNx_gridNy_source_issuedAt_targetAt_key" ON "ForecastSnapshot"("gridNx", "gridNy", "source", "issuedAt", "targetAt");

-- CreateIndex
CREATE INDEX "AirQuality_region_fetchedAt_idx" ON "AirQuality"("region", "fetchedAt");

-- CreateIndex
CREATE INDEX "Recommendation_userId_targetStartAt_idx" ON "Recommendation"("userId", "targetStartAt");

-- CreateIndex
CREATE INDEX "Recommendation_eventId_idx" ON "Recommendation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_userId_recommendationId_key" ON "Feedback"("userId", "recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "CollectLog_createdAt_idx" ON "CollectLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotifyLog_createdAt_idx" ON "NotifyLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_createdAt_idx" ON "AiCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clothing" ADD CONSTRAINT "Clothing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotifyLog" ADD CONSTRAINT "NotifyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

