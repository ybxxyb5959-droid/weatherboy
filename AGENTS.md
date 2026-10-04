# AGENTS.md

프로젝트: **뭐입을옷?**. 현재 구현은 Claude Code 가 맡고, Codex 는 사용자가 다시 맡길 때만 백엔드(`backend/`)를 담당한다. 시작 전 아래를 읽는다. 지시가 없으면 코드를 수정하지 말고 의견만 낸다.

## 작업 전 필수
1. `PROJECT_RULES.md` (규칙·담당 범위·공동 수정 파일·미결정 항목)
2. `HANDOFF.md` (현재 상태, 알려진 문제, 작업 기록)
3. 작업이 끝나면 `HANDOFF.md` 7번에 기록 형식(수정 목적 / 변경 파일 / 프론트 연결 사항 / 검증 결과)대로 한 건을 맨 위에 추가.

## 요약
- `frontend/` 는 직접 고치지 말고 `HANDOFF.md` 5번에 요청으로 남긴다. API 필드·에러 코드·enum 을 바꾸면 "프론트 연결 사항"에 반드시 적는다.
- 추천 판단은 Rule Engine 만, AI(Gemini)는 설명·사진 인식·일정 해석·코디 말투만 (`PROJECT_RULES.md` R-1~R-13).
- 스키마 변경은 새 Prisma 마이그레이션으로만, 개발 DB·테스트 DB 양쪽에 적용. API 를 바꾸면 `docs/api.md` 도 갱신.
- 비밀값(`.env`)은 읽어서 출력하거나 적지 않는다. 커밋/푸시는 사용자가 요청할 때만.
- 검증: `cd backend; npm run typecheck; npm run lint; npm test` (`TEST_DATABASE_URL` 필요).
- 미결정(`PROJECT_RULES.md` 11번)은 임의로 정하지 말고 사용자에게 묻는다.
