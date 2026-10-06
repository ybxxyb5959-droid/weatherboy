# CLAUDE.md

프로젝트: **뭐입을옷?** (날씨+옷장+일정 옷차림 추천 PWA). **현재 Claude Code 가 프론트(`frontend/`)와 백엔드(`backend/`)를 모두 구현**한다. GPT/Codex 는 브레인스토밍(의견 제시)만 하고, 사용자가 전달한 의견은 Claude 가 코드·문서와 대조해 판단한 뒤 반영한다.

## 작업 전 필수
1. `PROJECT_RULES.md` (규칙·계약 파일·미결정 항목)
2. `HANDOFF.md` (현재 상태, 알려진 문제, 다음 작업, 작업 기록)
3. 작업이 끝나면 `HANDOFF.md` 7번에 기록 형식대로 한 건 추가.

## 요약
- 프론트와 백엔드가 맞물리는 계약 파일(`PROJECT_RULES.md` 1-2)은 한쪽만 바꾸지 말고 양쪽을 함께 확인한다.
- 비밀값(`.env`)은 읽어서 출력하거나 적지 않는다. 커밋/푸시는 사용자가 요청할 때만.
- 검증: 프론트 `cd frontend; npx tsc --noEmit -p tsconfig.app.json; npm run lint; npm test; npm run build` / 백엔드 `cd backend; npm run typecheck; npm run lint; npm test`(`TEST_DATABASE_URL` 필요). 개발 서버는 `.claude/launch.json` (frontend 5180, backend 4000).
- 미결정(`PROJECT_RULES.md` 11번)은 임의로 정하지 말고 사용자에게 묻는다.
