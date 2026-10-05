ALTER TABLE "AiCallLog"
  ADD COLUMN "promptTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "totalTokens" INTEGER,
  ADD COLUMN "thoughtTokens" INTEGER;
