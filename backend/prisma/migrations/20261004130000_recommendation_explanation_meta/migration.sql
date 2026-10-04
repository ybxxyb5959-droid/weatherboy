-- AlterTable: AI 설명을 만들 때의 조건과 종류(ai/template). 지금 조건과 다르면 AI 문장 대신 템플릿을 보여 주는 데 쓴다. 예전 행은 비어 있다.
ALTER TABLE "Recommendation" ADD COLUMN "aiExplanationMeta" JSONB;
