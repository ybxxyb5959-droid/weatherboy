# 오늘 뭐 입지? — Backend

Node.js · Express 5 · TypeScript · PostgreSQL(Prisma) · 세션 인증(Kakao / Guest) · 기상청·에어코리아 · 결정론적 옷차림 Rule Engine · Worker(node-cron) · Web Push

문서: [`../docs`](../docs) (`api.md`, `auth.md`, `backend-architecture.md`, `external-apis.md`, `FRONTEND_INTEGRATION.md`, `deployment.md`, `backup-restore.md`)

## 1. 필요한 프로그램 (Windows 개발 기준)
- Node.js 20+ (확인: `node -v`), npm
- Docker Desktop (PostgreSQL 컨테이너용) — **엔진이 "Running" 이어야 합니다**

## 2. 설치
```powershell
cd backend
npm install
```

## 3. .env 만들기
```powershell
copy .env.example .env
```
`.env` 에서 최소한 아래를 채웁니다(실제 값은 Git 에 올리지 않습니다).
- `DATABASE_URL` — 아래 4번의 DB 를 쓰면 `postgresql://weather:<POSTGRES_PASSWORD>@localhost:5432/weather_boy`
- `SESSION_SECRET` — 16자 이상 랜덤 문자열 (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- 나머지 키(`KAKAO_*`, `KMA_SERVICE_KEY`, `AIRKOREA_SERVICE_KEY`, `VAPID_*`, `GEMINI_*`)는 비워도 서버는 뜹니다. 해당 기능만 "미설정" 오류(503)를 돌려줍니다.

## 4. DB 실행 (프로젝트 루트에서)
루트에 `.env` 를 만들어 DB 비밀번호를 정합니다(Git 제외).
```powershell
cd ..
"POSTGRES_PASSWORD=<원하는 비밀번호>" | Out-File -Encoding ascii .env
docker compose up -d postgres
```

## 5. Migration / Seed
```powershell
cd backend
npm run prisma:deploy     # 저장된 migration 적용 (스키마 수정 후 새 migration 은 npm run prisma:migrate)
npm run prisma:seed       # (선택) 관리자 지정 안내
```
> 데이터가 생긴 DB 에서는 `prisma migrate reset` 을 사용하지 마세요.

## 6. API 실행
```powershell
npm run dev          # http://localhost:4000  (GET /health, /ready)
```

## 7. Worker 실행 (별도 터미널)
```powershell
npm run dev:worker
```

## 8. 테스트
```powershell
npm run typecheck
npm run lint
npm test             # unit(DB 불필요) + integration(DB 필요, TEST_DATABASE_URL 이 없으면 .env 의 DATABASE_URL 사용)
```
통합 테스트는 외부 API 를 전부 Mock 하며 테스트용 사용자 데이터를 DB 에 남깁니다. 개발 DB 와 분리하려면 `TEST_DATABASE_URL` 에 별도 DB 를 지정하세요(먼저 `DATABASE_URL=<그 DB> npm run prisma:deploy`).

## 9. Build / Production 실행
```powershell
npm run build
npm run start            # API
npm run start:worker     # Worker
```

## Docker 로 전체 실행 (api + worker + postgres)
```powershell
# 루트에서
docker compose up -d --build
```

## Ubuntu Production
`../docs/deployment.md` (Docker Compose + Nginx + HTTPS), 백업은 `../docs/backup-restore.md`.

## 직접 해야 하는 설정
- Kakao Developers: 앱 생성 → REST API 키 → Redirect URI(`http://localhost:4000/api/auth/kakao/callback`, 운영 URL) 등록 → Client Secret 사용 시 값 발급, 카카오 로그인 활성화
- 공공데이터포털: **기상청_단기예보 조회서비스**, **기상청_중기예보 조회서비스**, **한국환경공단_에어코리아_대기오염정보** 활용 신청 후 서비스키
- VAPID 키: `npx web-push generate-vapid-keys`
- (선택) Gemini API 키 + `AI_ENABLED=true` + `GEMINI_MODEL=<사용할 모델 ID>`
