# 인수인계: 지금 해야 할 일 (GPT/다음 작업자용)

앱 이름: **뭐입을옷?** — 날씨 + 내 옷장 + 일정으로 오늘 입을 옷을 추천하는 모바일 우선 웹앱(PWA). 한국어 UI, "볼펜 낙서" 컨셉(졸라맨, 삐뚤빼뚤한 글씨/테두리).

## 0. 먼저 알아둘 것

- 구조: `frontend/`(React 19 + Vite + TS), `backend/`(Express 5 + Prisma + PostgreSQL, 세션 쿠키 로그인), `backend/src/worker.ts`(알림/수집 예약 작업). 문서는 `docs/`, `BACKEND_HANDOFF.md`.
- 로컬 실행: 프론트 `cd frontend && npm run dev -- --port 5180`(vite 가 `/api` 를 4000 으로 프록시), 백엔드 `cd backend && npm run dev`. DB 는 로컬 PostgreSQL(`backend/.env` 의 `DATABASE_URL`).
- 검증 명령: 프론트 `cd frontend && npx tsc --noEmit -p tsconfig.app.json`, 백엔드 `cd backend && npx tsc --noEmit && npx vitest run`(전용 테스트 DB `weather_boy_test` 필요, 새 마이그레이션은 거기에도 `DATABASE_URL=...weather_boy_test npx prisma migrate deploy` 로 적용).
- 비밀값(`backend/.env`, 키들)은 **절대 커밋/공유 금지**. `.gitignore` 에 이미 제외돼 있다.
- Windows 에서 `npx prisma generate` 가 `EPERM ... query_engine` 으로 실패하면 개발용 백엔드 서버(포트 4000)를 먼저 종료한 뒤 다시 한다.
- 사용자 말투 선호: 화면 문구는 짧고 친근한 한국어("~해요"), 안내는 토스트/작은 글씨로 최소화.

## 1. 지금 코드의 상태 (중요)

**아래 변경은 전부 아직 커밋되지 않았다.** `git status` 로 확인하고, 먼저 의미 단위로 나눠 커밋한다(`.env` 는 제외 확인).

최근에 한 작업 요약(커밋 전):
- 위치 허용 화면(`LocationGate`) → 알림 허용 화면(`NotifyGate`) → 홈. 서버에 알림 키가 없으면 알림 화면은 자동으로 생략된다. 그림은 `GateScenes.tsx`.
- 첫 화면(`IntroPage`): "뭐입을옷?" 제목 + 대(大)자 졸라맨(`IntroFigure`, 흰 반팔+네이비 바지 고정).
- 홈: 옷장이 비어 있으면 "오늘 추천" 자리에 옷 등록 안내만 표시, 추천 카드 우측 상단 공유 아이콘(오늘 코디 공유 카드), 옷장에 없는 추천 옷은 종류별 랜덤 색(`lib/genericColor.ts`), 칭호 소품은 홈에서 제외(내가 꾸민 것만).
- 칭호: 테마색 크레용 배경(`ThemeScribble`), 기본 칭호(BALANCED) 시소 꾸밈, 공유는 항상 내 실제 칭호.
- 옷장 빈 화면 그림(`Clothesline.tsx` `ClosetScene empty`), 일정 상세에 날짜별 아침/낮/저녁 날씨(`/api/events/:id/outfit` 응답에 `weather` 추가), 일정 등록 후 뒤로가기 흐름 수정, 캘린더 연동 버튼은 회색 + "준비중" 토스트.
- 방해금지 시간 사용자 설정(DB 마이그레이션 `20261002110000_quiet_hours`, 설정 > 알림 설정).
- 치마는 일반 추천/예시 옷에서 제외(성별 미지정).
- 배포 점검 반영: PWA manifest/아이콘, ErrorBoundary, 오프라인 오류 화면, 로그아웃 시 푸시 구독 해제, 옷 500벌/일정 1000개 상한.
- 이름/약관: 앱 이름 "뭐입을옷?", 운영자 박용빈, 문의 ybxxyb5959@gmail.com(`legalText.ts`).
- 배포 준비: `frontend/vercel.json`, `render.yaml`, `SERVE_FRONTEND_DIR`(서버가 화면까지 서비스하는 옵션), `prisma` 를 dependencies 로 이동(Docker 이미지에서 마이그레이션이 되도록).

## 2. 해야 할 일 (우선순위 순)

### A. 배포 (Vercel 화면 + Render 서버 + Neon DB, 알림 제외)
1. 변경 사항 커밋 → GitHub 비공개 저장소에 푸시.
2. Neon: 프로젝트 생성, **Direct(비풀링) 연결 주소** 복사.
3. Render: Blueprint 로 `render.yaml` 배포. Render 화면에서 비밀값 입력: `DATABASE_URL`, `SESSION_SECRET`(긴 랜덤), `KMA_SERVICE_KEY`, `AIRKOREA_SERVICE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, 카카오 키들, **알림용 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`(`mailto:`)**. 알림 키를 넣지 않으면 알림 화면은 자동으로 생략된다.
   - **알림을 무료로 돌리는 방법(PC 꺼도 됨):** `RUN_JOBS_IN_API=true`(render.yaml 에 이미 있음)로 알림/수집 작업을 API 프로세스 안에서 같이 돌린다. 그리고 Render 무료 서버가 잠들지 않도록 **UptimeRobot(무료) 등으로 `https://<render주소>/health` 를 5분마다 호출**한다. 서버가 깨어 있어야 15분마다 도는 알림 작업이 실행된다. Render 무료는 월 750시간이라 1개 서비스를 24시간 켜 둘 수 있다(무료 조건은 가입 시 재확인). 별도 worker 를 따로 돌린다면 `RUN_JOBS_IN_API` 는 끈다(알림 중복).
4. Render 주소가 나오면 `frontend/vercel.json` 의 `REPLACE-ME.onrender.com` 을 그 주소로 바꾸고 푸시.
5. Vercel: 저장소 가져오기, **Root Directory = `frontend`**, 배포 → `https://xxx.vercel.app`.
6. Render 환경변수 마무리: `FRONTEND_ORIGIN=https://xxx.vercel.app`, `KAKAO_REDIRECT_URI=https://xxx.vercel.app/api/auth/kakao/callback`. 카카오 개발자 콘솔 Redirect URI 에도 동일 등록(개발 모드에서는 등록한 테스트 사용자만 카카오 로그인 가능, "로그인 없이 둘러보기"는 키 없이 동작).
7. 검증: 폰 크롬에서 접속 → 게스트 시작 → 위치 허용 → 홈 날씨 표시 → 쿠키 로그인 유지(새로고침 후에도 로그인 상태) → "홈 화면에 추가".
   - 로그인 직후 풀리면 쿠키 전달 문제: Vercel rewrite 가 Set-Cookie 를 넘기는지, Render 의 `X-Forwarded-Proto`/`trust proxy` 를 확인한다.
8. Render 무료는 15분 유휴 시 잠든다(첫 접속 30~60초). 이는 정상이다.

### B. 안드로이드 앱(APK) — 선택
- 배포가 끝나 https 주소가 정해진 뒤 PWABuilder/Bubblewrap 으로 TWA APK 생성. 앱 이름 "뭐입을옷?", 아이콘은 `frontend/public/icon-512.png`. Digital Asset Links(`/.well-known/assetlinks.json`)를 프론트에 추가해야 주소창 없이 열린다.

### C. 제품 백로그
- 캘린더 연동: 지금은 iCal 비공개 주소 붙여넣기 방식(번거로움)이라 버튼을 비활성(회색+토스트)해 둔 상태. 순서: ① 일정 상세에 "달력에 추가"(.ics 파일 내려받기) ② 구글 캘린더 OAuth 읽기 연동(구글 앱 심사 필요, calendar.readonly 는 민감 권한) ③ 필요하면 네이티브 래핑.
- 알림(웹푸시): VAPID 키 + 상시 실행 작업이 필요. 위 A-3 방식(API 안에서 작업 실행 + 핑으로 깨워 두기)으로 무료 운영 가능하나 서버가 가끔 재시작/지연될 수 있다. 더 안정적으로 하려면 월 5달러급 서버(예: AWS Lightsail 90일 무료 체험 후 월 5달러, Docker Compose 그대로 사용) + 무료 도메인(DuckDNS) + Caddy(HTTPS)로 이전. 이때 `VAPID_SUBJECT` 는 실제 연락처(`mailto:`)로.
- 공유 메시지: `HomePage.shareOutfit`/`CharacterPage.share` 의 공유 텍스트에 `window.location.origin` 이 들어간다. 배포 주소가 정해지면 확인.
- 공유 카드 하단(초대 문구/주소/초대 코드)은 일단 제거된 상태. 배포 후 필요하면 다시 추가.
- 오프라인: 서비스워커(`public/sw.js`)는 푸시 전용. 앱 껍데기 캐싱이 필요하면 추가.
- 글꼴(Gaegu 등)을 Google Fonts 에서 받는다 → 네트워크가 막히면 대체 글꼴. 배포 전에 자체 호스팅 권장.
- 프론트 번들 약 645KB(gzip 200KB): 화면별 코드 분할(`React.lazy`) 검토.
- 린트 경고 약 15개(`oxlint`: 렌더 중 `Date` 사용, effect 안 setState 등) — 동작 문제는 아니나 정리 가능.
- 아이폰: 사파리에서 "홈 화면에 추가"한 앱에서만 알림 가능(iOS 16.4+). 알림 화면에서 안내 문구 있음.
- 약관/개인정보처리방침은 일반 문구라 공개 전 법률 검토 필요. 카카오 정식 오픈에는 개인정보처리방침 주소·문의처 필요.
- 성별: 현재 성별 설정이 없어 치마를 일반 추천에서 뺐다. 필요하면 설정에 성별/스타일 선택을 추가.

## 3. 주의

- 백엔드 테스트가 전체 실행 시 가끔 1개 파일이 실패했다가 재실행하면 통과한 적이 있다(원인 미확인, 병렬/DB 상태 추정). 재실행으로 확인.
- 새 DB 컬럼을 추가하면 개발 DB, 테스트 DB 양쪽에 마이그레이션을 적용해야 테스트가 통과한다.
- 로컬 개발 서버 상태(참고): 프론트 5180, 백엔드 4000(`preview_start backend` 로 시작). 서버를 껐다 켤 일이 있으면 기존 프로세스를 먼저 정리.
