# PROJECT_RULES.md — 뭐입을옷? 공통 작업 규칙

**2026-10-04 방침 변경: 프론트·백엔드 구현은 모두 Claude Code 가 맡는다.** GPT 는 브레인스토밍(의견)만 주고 코드는 만들지 않는다 — 사용자가 GPT 의견을 전달해 주면 Claude 가 판단해 반영한다. 아래 담당 표는 **나중에 Codex 를 다시 쓰게 될 때를 위한 기본 분담**으로 남겨 둔다. 규칙(디자인·백엔드·계약 파일)은 그대로 적용된다.

- 이 문서는 **2026-10-04 기준 실제 코드(커밋 `22efa30`)를 읽고 정리**한 것이다. 코드와 문서가 다르면 코드가 맞고, 그 자리에서 문서를 고친다.
- 표기: **📍** = 관련 코드 위치 / **❓ 미결정** = 아직 정해지지 않았으니 임의로 정하지 말고 사용자에게 물을 것.
- 규칙 번호(D-1, B-1 …)는 `HANDOFF.md` 기록에서 "어떤 규칙에 따라 했는지" 적을 때 쓴다.
- 새로 정해진 규칙은 이 문서에 추가하고, 정해지지 않은 것은 **11. 미결정 목록**에 올린다.

---

## 0. 프로젝트 한눈에

**뭐입을옷?** — 날씨 + 내 옷장 + 일정으로 오늘 입을 옷을 추천하는 모바일 우선 웹앱(PWA). 한국어 UI, "볼펜 낙서" 컨셉(졸라맨, 삐뚤빼뚤한 글씨/테두리). 현재 **베타 테스트 단계**.

| 영역 | 기술 | 위치 |
|---|---|---|
| 프론트 | React 19 + Vite 8 + TypeScript 6 + react-router-dom 7 (상태관리/UI/애니메이션 라이브러리 **없음**) | `frontend/` |
| 백엔드 | Node 20+ · Express 5 · Prisma 6 · PostgreSQL · zod 4 · express-session · node-cron · web-push | `backend/` |
| 배포 | 화면=Vercel, API=Render(Docker, 무료), DB=Neon(배포) / 로컬 PostgreSQL(개발) | `render.yaml`, `frontend/vercel.json`, `backend/Dockerfile` |
| 대안 배포 | 한 서버에 Docker Compose + Caddy | `deploy/lightsail/`, `Dockerfile.app`, `docker-compose.yml` |

**먼저 알아둘 것**
- `docs/` 폴더와 `BACKEND_HANDOFF.md` 는 `.gitignore` 로 **git 에 올라가지 않는다**("internal docs, kept locally"). 같은 폴더를 공유하는 동안만 서로 보인다. 이 문서(`PROJECT_RULES.md`, `HANDOFF.md`, `CLAUDE.md`, `AGENTS.md`)는 git 에 올라간다. 📍 `.gitignore`
- `backend/.env`, 루트 `.env`, `backups/*.dump`, `*.zip` 도 git 제외. **비밀값(키, 비밀번호, 토큰)은 절대 문서·커밋·채팅에 적지 않는다.**
- `frontend/dist`, `backend/dist` 는 빌드 산출물(git 제외)이라 낡아 있을 수 있다. 읽지 말고 `src/` 를 본다.

---

## 1. 담당 범위와 공동 수정 파일

### 1-1. 담당 (기본 원칙)

| 담당 | 맡는 곳 | 하지 않는 것 |
|---|---|---|
| **Claude Code = 프론트엔드** | `frontend/src/**`, `frontend/public/**`, `frontend/index.html`, `frontend/*.config.*`, `frontend/package.json` | `backend/**` 수정 |
| **Codex = 백엔드** | `backend/src/**`, `backend/prisma/**`, `backend/tests/**`, `backend/package.json`, `backend/Dockerfile`, `backend/scripts/**` | `frontend/**` 수정 |

- 상대 영역에서 고칠 게 보이면 **직접 고치지 말고** `HANDOFF.md` 의 "상대에게 요청" 에 적는다(무엇이, 왜, 어느 파일/줄).
- 예외: 한 줄짜리 오타·주석처럼 동작에 영향 없는 수정은 직접 고치고 기록에 남긴다.
- 사용자(박용빈)가 "이건 네가 해"라고 명시한 작업은 영역과 상관없이 한다. 그때도 기록에 남긴다.

### 1-2. 공동 수정이 필요한 파일 (양쪽이 맞물리는 곳)

한쪽만 바꾸면 반대쪽이 깨지는 **계약 지점**이다. 바꿀 때는 반드시 양쪽 모두 확인하고 `HANDOFF.md` 에 "프론트 연결 사항"을 적는다.

| 계약 | 백엔드 쪽 📍 | 프론트 쪽 📍 | 규칙 |
|---|---|---|---|
| API 응답/요청 모양 | `backend/src/api/routes/*.ts`, `backend/src/services/serializers.ts`, `recommendationService.ts` | `frontend/src/types.ts`, 각 화면의 `api<T>()` 호출 | 필드를 **추가**하는 건 자유(프론트는 몰라도 동작). **이름 변경·삭제·타입 변경**은 프론트와 같은 날 함께 처리 |
| 옷 종류/색/무늬/두께/일정 종류/후기 값 (한글 enum) | `backend/src/config/mappings.ts` (**단일 지점**), `prisma/schema.prisma` enum | `frontend/src/mocks/clothes.ts`(`clothingTypes`, `categories`, `colorNames`, `colorHex`, `patternNames`, `thicknesses`), `mocks/events.ts`, `lib/clothingParse.ts`, `lib/eventParse.ts`, `components/ClothingDoodle.tsx` | 항목을 추가하면 **백엔드 매핑 + Prisma 마이그레이션 + 프론트 목록·그림·색**을 한 번에. 옷 종류를 추가했는데 그림이 없으면 화면이 깨진다 |
| 캐릭터 칭호 20종(key) | `backend/src/services/character/analysis.ts` (`TitleKey`) | `frontend/src/lib/character.ts` (`PERSONA_WEAR`), `components/StickPerson.tsx`, `CharacterDecor.tsx`, `ThemeScribble.tsx` | key 문자열이 양쪽에서 같아야 한다 |
| 캐릭터 꾸미기 아이템 id | `backend/src/services/character/catalog.ts` (`CATALOG`) | `frontend/src/components/CharacterDecor.tsx` (같은 id 로 그림) | 서버 카탈로그에 id 를 넣으면 프론트에 그림이 **반드시** 있어야 한다 |
| 에러 `code` → 화면 동작 | `backend/src/utils/errors.ts`, 각 라우트의 `AppError`, `api/middleware/aiLimits.ts` | `frontend/src/api.ts`, `lib/ai.ts` (`isPhotoLimit`), `pages/ReviewPage` 등 | 새 코드를 만들면 프론트가 그 코드를 어떻게 보여줄지 정한다 (6-4) |
| 로그인/세션/쿠키/CORS | `backend/src/app.ts`, `routes/auth.ts`, `middleware/common.ts`, `config/env.ts` (`FRONTEND_ORIGIN`) | `frontend/src/api.ts`, `auth.tsx`, `vite.config.ts` (프록시), `frontend/vercel.json` (rewrite) | 도메인·쿠키 설정을 바꾸면 Vercel rewrite 와 Render 환경변수까지 같이 본다 |
| 웹푸시 payload `{title, body, url}` | `backend/src/services/push/push.ts`, `jobs/*Push*.ts` | `frontend/public/sw.js`, `lib/push.ts`, `components/PushToggle.tsx`, `NotifyGate.tsx` | payload 키를 바꾸면 `sw.js` 도 같이. **베타 동안 `PUSH_ENABLED=false`** (11번) |
| 기능 스위치 | (없음) | `frontend/src/config/features.ts` (`PUSH_ENABLED`) | 서버 쪽이 필요한 기능을 프론트가 켜고 끌 때는 기록에 적는다 |
| 배포 설정 | `render.yaml`, `backend/Dockerfile`, `backend/docker-start.sh` | `frontend/vercel.json` (`/api` rewrite 대상 주소) | Render 주소가 바뀌면 `vercel.json` 도 바꾼다 |
| 관리자 화면 | `backend/src/api/routes/admin.ts`, `services/ai/aiUsageReport.ts` | `frontend/src/pages/AdminPage.tsx` | 응답 모양을 바꾸면 화면도 같이 |
| 화면 문구 중 "서버가 만들어 주는 문장" | `backend/src/rules/*`, `services/**` (headline, sub, reasons, 한도 안내문 등) | 프론트는 **그대로 표시**한다 | 문구를 바꾸면 말투 규칙(D-9)을 지킨다 |
| 약관·개인정보·운영자 정보 | – | `frontend/src/pages/legalText.ts` | 백엔드가 수집/저장하는 데이터가 바뀌면 이 문서의 내용도 맞는지 확인 |
| API 명세 문서 | `docs/api.md` (로컬 전용) | – | **백엔드 담당이 갱신**한다. 현재 일부 누락 (HANDOFF 알려진 문제 참고) |

### 1-3. 둘 다 건드리지 않는 곳 / 조심할 곳
- `backend/prisma/migrations/**` 는 **한 번 적용된 파일을 수정하지 않는다**. 새 마이그레이션만 추가.
- `package.json`/`package-lock.json` 에 새 의존성을 넣을 때는 사용자에게 먼저 묻는다(현재 프론트 의존성은 react / react-dom / react-router-dom 3개뿐이다).
- 두 사람이 **동시에** 같은 파일을 만지지 않는다. 작업을 시작할 때 `git status` 로 상대가 남긴 미커밋 변경이 있는지 본다(2-2).

---

## 2. 작업 방식 (교대 작업)

### 2-1. 시작할 때
1. `PROJECT_RULES.md` → `HANDOFF.md` 순서로 읽는다 (특히 "현재 작업 상태", "알려진 문제", 맨 아래 **최근 작업 기록**).
2. `git status`, `git log --oneline -10` 으로 상대가 남긴 변경을 확인한다.
3. 내 담당이 아닌 파일을 고쳐야 한다면 1-1 규칙을 따른다.

### 2-2. 하는 동안
- 작은 단위로 한다. 한 번에 한 목적. 서비스 동작을 바꾸는 변경은 **문서 정리와 섞지 않는다**.
- 상대가 커밋하지 않은 변경이 작업 폴더에 남아 있으면 **덮어쓰거나 되돌리지 않는다.** 사용자에게 알린다.
- 커밋/푸시는 **사용자가 요청할 때만** 한다.

### 2-3. 끝날 때 (필수)
- `HANDOFF.md` 맨 아래 **"작업 기록"** 에 정해진 형식(수정 목적 / 변경 파일 / 프론트 연결 사항 / 검증 결과)으로 한 건을 **위에 추가**한다.
- 검증은 4번(공통 검증 명령)대로 하고, **실제 실행한 것만** 적는다. 못 한 검증은 "못 함 + 이유"로 쓴다.

### 2-4. 한도가 다 되어 다른 도구로 넘길 때
위 2-3 을 마치고, 진행 중이던 일은 `HANDOFF.md` 의 "진행 중 / 다음 작업"에 **어디까지 했고 무엇이 남았는지** 적는다. 중간 상태의 코드는 동작하게 두거나, 동작하지 않는다면 그 사실과 파일을 명시한다.

---

## 3. 디자인 규칙 (프론트 담당, 백엔드는 읽기만)

컨셉: **도화지에 볼펜으로 그린 낙서.** 선은 삐뚤고, 글씨는 손글씨, 색은 거의 없고 포인트에만 쓴다.

### 3-1. 색상

| 번호 | 규칙 | 📍 |
|---|---|---|
| D-1 | 기본 색은 **종이 + 잉크** 둘뿐. 토큰: `--paper #fcfcfa`(종이), `--paper-dark #eeeeec`(종이 밖 배경), `--ink #222`(글씨·선), `--pick #e5e5e5`(선택된 칸 배경). 새 화면도 이 네 가지로 만든다 | `frontend/src/styles/global.css:1-8` |
| D-2 | **라이트 전용.** `color-scheme: only light` + `<meta name="color-scheme" content="light">`. 다크 테마를 임의로 추가하지 않는다(❓ 11번) | `global.css:2`, `frontend/index.html` |
| D-3 | 포인트 색은 의미가 있을 때만: 위험/삭제=붉은 `#c0483a`(`.danger-btn`), 눈물/비=연한 파랑, 해=노랑 `#f2cf4a`, 카카오 버튼=`#fee500`, 최저기온=파랑·최고기온=빨강. 이 색들은 **토큰이 없고** 코드에 직접 적혀 있다(❓ 11번) | `global.css:1573`, `components/DoodleWeather.tsx`, `FigureArt.tsx`, `KakaoLoginButton.tsx` |
| D-4 | **옷 색은 한 곳에서만** 정의한다: `colorHex` (검정 `#3a3a3a`, 회색 `#b4b4b0`, 흰색 `#fbfaf4` … 16색). 옷 그림은 이 값으로 칠한다. 다른 곳에 옷 색 hex 를 새로 적지 않는다 | `frontend/src/mocks/clothes.ts` |
| D-5 | 순수 검정(`#000`)·진한 채도 색을 넓은 면에 쓰지 않는다. 면 채우기는 연한 색(예: 체크 표시 `#f2e8c8`) | `components/DoodleCheck.tsx` |
| D-6 | 추천에 없는 옷의 색은 종류별로 정해진 임의 색을 쓴다 | `frontend/src/lib/genericColor.ts` |

### 3-2. 폰트

| 번호 | 규칙 | 📍 |
|---|---|---|
| D-7 | 기본 폰트는 `--font` = **Gaegu** → Nanum Pen Script → Comic Sans MS → cursive. 화면 글씨는 전부 `var(--font)` | `global.css:7` |
| D-8 | **Poor Story** 는 졸라맨 말풍선, 코디 도우미 칩, 홈 일부에만 쓴다(`font-family: 'Poor Story', var(--font)`). 새 폰트를 추가하지 않는다 | `global.css:1327, 3748-3810` |
| D-8a | 시스템 고딕(`-apple-system … Noto Sans KR`)은 **관리자 화면 등 낙서 컨셉 밖**에서만 쓴다(1곳) | `global.css` (font-family: -apple-system 위치) |
| D-8b | 폰트는 Google Fonts 에서 받는다(`<link>`). 네트워크가 막히면 대체 폰트로 보인다. 자체 호스팅은 아직 안 했다(❓ 11번) | `frontend/index.html` |
| D-8c | 글자 크기(px): 본문 19 · 작은 글 `.tiny` 15 · 버튼 20 / 작은 버튼 17 / 큰 버튼 23 · `h2` 24 · `h1` 34 · 큰 숫자 `.big` 66. 자주 쓰는 중간값은 16·17·18·20·21·22. 이 범위를 벗어나는 크기는 화면 맥락(제목 장식 등)에서만 | `global.css` (`body`, `h1`, `h2`, `.tiny`, `.big`, `.dbtn`) |
| D-8d | **글자는 `HandText` 로 감싼다**(글자마다 아주 조금씩 기울기·높이·크기가 다른 손글씨 효과, 같은 글자는 항상 같은 모양). 보조기기용 원문은 `sr-only` 로 같이 들어간다 | `components/HandText.tsx` |

### 3-3. 간격·모양·레이아웃

| 번호 | 규칙 | 📍 |
|---|---|---|
| D-10 | **모바일 우선 한 칸 레이아웃.** 종이(`.app`)는 최대 폭 **460px**, 가운데 정렬, 좌우 패딩 **16px**, 위 18px(+safe-area), 아래 **96px**(하단 네비 자리). 데스크톱도 같은 폭 | `global.css` `.app` |
| D-11 | 간격은 4px 배수 위주: 요소 사이 `gap` **8 / 10 / 12**(`.row`=10, `.col`=12), 섹션 `margin-top` 22px. 가장 많이 쓰는 값은 8·10·6·4 | `global.css` `.row`, `.col`, `.section` |
| D-12 | **선 두께**: 상자(`.box`) 2.2px, 버튼(`.dbtn`) 2.4px, SVG 그림 2.2~2.6px, 하단 네비 윗선 2.4px. 선 색은 항상 `--ink` | `global.css` |
| D-13 | **모서리는 반듯하지 않게**: `border-radius` 를 `9px 18px 11px 15px / 16px 8px 17px 10px` 처럼 8값으로 비대칭으로 준다. 변형은 `.w1 .w2 .w3`(약간 다른 둥글기 + ±0.3~0.8° 기울기) 이고, 같은 줄의 요소는 `w` 번호를 돌려가며(`seed % 4`) 쓴다 | `global.css` `.box`, `.dbtn`, `components/DoodleButton.tsx` (`doodleClass`) |
| D-14 | 터치 영역 최소 **44px**(작은 버튼 36px, 큰 버튼 52px). 키보드 포커스는 점선 아웃라인 `2px dashed var(--ink)` | `global.css` `.dbtn`, `:focus-visible` |
| D-15 | 겹침 순서: 하단 네비 `z-index:10`, 모달·토스트 `z-index:50` | `global.css` `.bottom-nav`, `.modal-back`, `.toast` |
| D-16 | 손으로 그은 줄이 필요하면 `<hr class="scribble">` | `global.css` `.scribble` |

### 3-4. 공통 컴포넌트 — **새로 만들기 전에 먼저 이걸 쓴다**

| 용도 | 컴포넌트 | 📍 `frontend/src/components/` |
|---|---|---|
| 글자(손글씨 효과) | `HandText` | `HandText.tsx` |
| 버튼 / 선택 버튼 줄 | `DoodleButton`, `ChoiceRow`, `doodleClass()` | `DoodleButton.tsx` |
| 체크박스 | `DoodleCheck` | `DoodleCheck.tsx` |
| 상자 | CSS 클래스 `box w1~w3` (컴포넌트 아님) | `global.css` |
| 확인 창 | `ConfirmDialog` (바깥 누르면 취소) | `ConfirmDialog.tsx` |
| 토스트 | `useToast()` + `<Toast>` (2.2초, 하단 메뉴 위) | `Toast.tsx` |
| 뒤로가기 / 달력 화살표 | `BackButton`, `ArrowButton` (박스 없이 낙서 화살표만) | `BackButton.tsx`, `ArrowButton.tsx` |
| 하단 메뉴 | `BottomNav` (홈·옷장·캐릭터·일정·설정 5개) | `BottomNav.tsx` |
| 입력 위젯 | `DatePicker`, `TimePicker`, `MonthCalendar`, `PlaceInput`, `LocationPicker`, `LocationBar` | 각 파일 |
| 오류 화면 | `ErrorBoundary`, `ConnectError`(App.tsx 안) | `ErrorBoundary.tsx`, `App.tsx` |
| 한도 안내 | `LimitNotice` + `AiUsageBar` | `LimitNotice.tsx`, `AiUsageBar.tsx` |
| 옷 그림 / 옷 빨랫줄 | `ClothingDoodle`(`ClothingArt`), `Clothesline` | `ClothingDoodle.tsx`, `Clothesline.tsx` |
| 날씨 그림 | `DoodleWeather` (`WeatherKind`), `GearDoodles`(우산·마스크·선크림), `UmbrellaDoodle` | `DoodleWeather.tsx` 등 |
| 도구 아이콘 | `CameraIcon`, `HandIcon`, `LockIcon` (이모지 대신 낙서 아이콘) | `ToolIcons.tsx`, `icons.tsx` |

- D-17 **이모지를 UI 아이콘으로 쓰지 않는다**(커밋 `b0cdfea`에서 낙서 아이콘으로 교체). 아이콘이 필요하면 SVG 로 손그림 스타일로 그린다.
- D-18 새 공통 컴포넌트를 만들었으면 이 표에 한 줄 추가한다.
- D-19 접근성: 장식 SVG 는 `aria-hidden="true"`, 클릭하는 그림에는 `aria-label`, 토스트는 `role="status"`, 경고는 `role="alert"`, 모달은 `role="alertdialog"`.

### 3-5. 손떨림(wobble) 필터

- 선을 살짝 흔드는 SVG 필터 두 개가 `App.tsx` 맨 위에 **한 번만** 정의돼 있다: `#wobble`(강함, scale 4), `#wobble-soft`(약함, scale 1.5). 그림 SVG 에는 `className="doodle"`(= `filter:url(#wobble)`)을 붙인다.
- 새 그림은 `class="doodle"` 만 붙이고 필터를 새로 정의하지 않는다. 📍 `App.tsx:62-72`, `global.css` `.doodle`

### 3-6. 캐릭터(졸라맨) 규칙

| 번호 | 규칙 | 📍 |
|---|---|---|
| C-1 | 졸라맨 그림의 공통 SVG 속성은 `figureSvgProps`: `viewBox 0 0 140 160`, 선 `#222`, 두께 2.6, 둥근 끝. 새 졸라맨도 이 값을 쓴다 | `components/figureProps.ts` |
| C-2 | 첫 화면(`IntroPage`)의 졸라맨은 **흰 반팔 + 네이비 바지로 고정**. 인사 졸라맨(`GreetingFigure`)도 같은 옷·비율 | `IntroFigure.tsx`, `GreetingFigure.tsx`, `greetingPose.ts` |
| C-3 | 인사 졸라맨은 **펜으로 한 획씩 그린 뒤 손을 흔든다**(`stroke-dashoffset`, 마스크 사용 안 함). 획 순서: 머리→얼굴→몸통→팔→다리→바지→티셔츠 | `GreetingFigure.tsx` (`STEPS`), `FigureArt.tsx` |
| C-4 | 표정은 `Face = 'smile' \| 'flat' \| 'cry'` 셋. 눈물 색은 파랑 `#5aa0d8` | `FigureArt.tsx` |
| C-5 | 상황 그림(`StickPerson`)은 `Mood`(`wave cold rain trip empty wait stand travel camp hike outdoor birthday date meal drink gift show sport work`) 로 고른다. 새 상황이 필요하면 `Mood` 에 추가하고 그림을 같은 파일에 만든다 | `components/StickPerson.tsx` |
| C-6 | `mood='stand'` 일 때만 **추천 옷(`wear`)·우산·칭호 소품(`persona`)·꾸미기(`accessories`)** 가 붙는다. 손/팔은 소매 길이에 맞춰 옷 위에 따로 그린다(`Hands`) | `StickPerson.tsx` |
| C-7 | 꾸미기 슬롯은 6개: `hat hairpin glasses neck face extra`. 슬롯마다 아이템 하나. 그림 좌표계는 `StickPerson 'stand'` 와 같다(머리 중심 60.5,30 · 반지름 약 17.5 · 눈 53.5/66.5) | `components/CharacterDecor.tsx`, 서버 `services/character/catalog.ts` |
| C-8 | 칭호(20종)마다 **기본 복장**이 있다(`PERSONA_WEAR`), 칭호가 없으면 `BASIC_WEAR`(흰 반팔+파란 바지) | `frontend/src/lib/character.ts` |
| C-9 | 홈과 캐릭터 화면은 **같은 캐릭터 데이터를 공유**(모듈 캐시+구독). 꾸미기를 저장하면 홈의 캐릭터도 바로 바뀐다 | `lib/character.ts` (`useCharacter`) |
| C-10 | 캐릭터는 **잠금 개념이 있다**: 옷장에 직접 담은 옷이 `minClothes`(현재 10)벌 미만이면 칭호·꾸미기가 잠긴다(탭에 잠금 표시). ❓ 이 방침이 최종인지는 11번 | `lib/character.ts`(`unlocked`), `BottomNav.tsx`, 서버 `analysis.ts` (`MIN_CLOTHES`) |

### 3-7. 애니메이션 규칙

| 번호 | 규칙 | 📍 |
|---|---|---|
| A-1 | 애니메이션은 **CSS `@keyframes` + SVG** 로만 한다(현재 36개). 애니메이션 라이브러리를 추가하지 않는다 | `global.css` |
| A-2 | 움직임이 있는 것은 **`@media (prefers-reduced-motion: reduce)` 에서 멈추게** 한다(현재 20곳에 적용). 새 애니메이션도 같이 쓴다 | `global.css` |
| A-3 | 움직임은 "가볍고 장난스럽게": 짧게(≈1초 안팎) 흔들거나 튀는 정도. 화면 전환을 가리는 긴 연출을 넣지 않는다 | – |
| A-4 | 코디 도우미 연출(캐릭터가 옷장으로 뛰어가 옷을 갈아입고 돌아옴 → 카드가 차례로 떨어짐)은 `stage-*`, `look-drop`, `ask-in`, `stylist-pop` 키프레임이 맡는다. 졸라맨 몸은 움직이고, 팔만 따로 흔드는 연출은 쓰지 않는다(커밋 `7e87920`) | `components/EventStylist.tsx`, `global.css` |
| A-5 | 그림을 그리는 연출(인사 졸라맨, 체크 표시 `dcheck-draw`)은 `stroke-dashoffset` 으로 선을 실제로 이어 그린다 | `GreetingFigure.tsx`, `DoodleCheck.tsx` |

### 3-8. 화면 문구(말투)

- D-9 **짧고 친근한 한국어("~해요", "~어요").** 안내는 토스트·작은 글씨로 최소화. 에러는 "무엇이 안 됐고 → 지금 할 수 있는 일" 순서로 한 문장 안팎. 존댓말·반말 섞지 않는다.
- D-9a 받침에 따라 달라지는 조사는 `josa` 유틸을 쓴다(은/는, 이/가…). 📍 `backend/src/utils/josa.ts` (서버가 만드는 문장용). 프론트 문장은 받침을 피해 쓰거나 같은 방식으로 처리.
- D-9b 서버가 준 문장(`headline`, `sub`, `reasons`, 한도 안내문)은 프론트가 **고치지 않고 그대로** 보여준다.
- D-9c 분위기 이름 뒤 "느낌" 붙이기는 `feel()` 사용(중복 방지). 📍 `frontend/src/lib/styleText.ts`

### 3-9. 화면 구조(라우팅)

📍 `frontend/src/App.tsx`
- `/` 브라우저=소개(`LandingPage`), 설치된 앱(standalone)=로그인/홈 · `/start` 로그인 · `/tour` 둘러보기(설치 전만) · `/home` `/wardrobe`(+`/scan` `/add` `/:id/edit`) `/character` `/events`(+`/new` `/:id` `/:id/edit`) `/settings`(+`/:section`) `/review` `/support` · `/admin` · `/weather`(날씨 낙서 미리보기, 개발용)
- 로그인 필요 화면은 `<Protected>` 로 감싼다. 하단 네비는 `/`, `/start`, `/tour`, `/admin` 에서 숨긴다.
- 새 화면을 추가하면 이 목록과 `BottomNav` 표시 규칙을 같이 갱신한다.

---

## 4. 백엔드 구조 (현재 Claude 가 구현, 기본 분담은 Codex)

```
Browser(PWA) ──/api──▶ API (Express 5) ──▶ PostgreSQL (Prisma)
  Vercel rewrite        │                      ▲
  (또는 Vite proxy)     ├──▶ Kakao OAuth·Local │
                        ├──▶ 기상청(KMA)·에어코리아
                        ├──▶ Gemini (AI)       │
                        └─ Worker(node-cron) ──┘──▶ Web Push
```

### 4-1. 디렉터리 📍 `backend/src/`

| 경로 | 역할 |
|---|---|
| `server.ts` / `app.ts` / `worker.ts` | API 진입점 / Express 조립(미들웨어·라우터 등록) / 예약 작업 진입점 |
| `api/routes/*.ts` | HTTP 라우터. 얇게 유지(검증→서비스 호출→응답) |
| `api/middleware/common.ts` | `requireAuth`, `requireAdmin`, `originGuard`, `parse(zod)`, `wrap`, 에러 핸들러 |
| `api/middleware/aiLimits.ts` | AI 시간당/하루 한도 가드 |
| `config/` | `env.ts`(zod 로 환경변수 검증), `mappings.ts`(한글↔enum **단일 지점**), `ruleConfig.ts`(추천 수치 전부), `sampleClothes.ts` |
| `rules/` | **결정론적 판단**: `outfitEngine`(추천), `feelsLike`(체감온도), `clothing`, `colorHarmony`(색 궁합), `outfitStyle`(분위기·상황 금기), `outfitWish`(사용자 요청 해석) |
| `services/` | 외부/도메인 로직: `weather/`, `airQuality/`, `kakao/`, `push/`, `ai/`, `calendar/`, `character/`, `review/`, `recommendationService`, `stylistOutfit`, `feedbackBands`, `location`, `serializers` |
| `jobs/` | 예약 작업: 날씨·대기질 수집, 일정 예보 점검, 일일 알림, 캘린더 동기화 |
| `utils/` | `errors`(AppError), `time`(KST/UTC), `grid`(위경도→기상청 격자), `josa`, `logger`(pino, 비밀 redact) |
| `db.ts` | Prisma 클라이언트 |

### 4-2. 라우터 한눈에 📍 `backend/src/app.ts`

| 접두 | 파일 | 주요 경로 |
|---|---|---|
| `/api/auth` | `auth.ts` | `POST /guest` · `GET /kakao`, `/kakao/callback` · `POST /logout` |
| `/api/me` | `auth.ts` | `GET /` · `DELETE /`(회원 탈퇴) |
| `/api` | `user.ts` | `GET/PUT /settings` · `POST /onboarding/complete` · `GET /geocode` |
| `/api` | `places.ts` | `GET /places/suggest`, `/places/reverse` · `GET/POST/DELETE /favorites` |
| `/api/clothes` | `clothes.ts` | CRUD(삭제는 soft delete) |
| `/api/events` | `events.ts` | CRUD + `GET /:id/outfit` |
| `/api/weather` | `weather.ts` | `GET /today` |
| `/api/recommendations` | `weather.ts` | `GET /today` · `POST /:id/feedback` |
| `/api/ai` | `ai.ts` | `GET /status`, `/usage` · `POST /clothing-from-photo`, `/clothes-from-photo`, `/parse-event` · `GET /event-stylist/:eventId/start` · `POST /event-stylist` · `DELETE /event-stylist/:eventId` |
| `/api/character` | `character.ts` | `GET /` · `PUT /`(꾸미기 저장) |
| `/api/calendar` | `calendar.ts` | iCal 연동(목록·추가·동기화·삭제) |
| `/api/push` | `push.ts` | `GET /public-key` · `POST/DELETE /subscribe` |
| `/api/reviews`, `/api/support` | `reviews.ts`, `support.ts` | 앱 후기 / 문의 |
| `/api/admin` | `admin.ts` | 비밀번호 로그인 + 대시보드·후기·문의·AI 사용량 |
| `/health`, `/ready` | `app.ts` | 프로세스 생존 / DB 연결 |

### 4-3. 규칙

| 번호 | 규칙 | 📍 |
|---|---|---|
| B-1 | 라우트는 `wrap()` 으로 감싸 async 에러를 에러 핸들러로 넘긴다. 입력은 **zod + `parse()`** 로 검증하고 실패하면 400 `VALIDATION_ERROR` | `api/middleware/common.ts` |
| B-2 | 한글 값 ↔ DB enum 변환은 **`config/mappings.ts` 한 곳에서만**. 라우트·서비스에서 문자열을 직접 바꾸지 않는다 | `config/mappings.ts` |
| B-3 | 추천에 쓰는 **모든 수치는 `config/ruleConfig.ts`** 에 둔다(코드 안에 숫자 상수를 흩뿌리지 않는다). 수치를 바꾸면 `tests/unit/rules.test.ts` 등을 갱신 | `config/ruleConfig.ts` |
| B-4 | 시간은 **DB 에 UTC 로 저장, 표시·날짜 판단은 KST(Asia/Seoul)**. `utils/time.ts` 의 함수(`kstDate`, `fromKst` …)만 쓴다. API 의 날짜/시간 문자열은 KST(`YYYY-MM-DD`, `HH:mm`) | `utils/time.ts` |
| B-5 | **스키마 변경은 Prisma 마이그레이션으로만.** 새 파일을 추가하고, 적용된 마이그레이션은 수정하지 않는다. 데이터가 있는 DB 에 `migrate reset` 금지. 개발 DB·테스트 DB **양쪽에** 적용한다 | `backend/prisma/migrations/` |
| B-6 | 환경변수는 `config/env.ts` 의 zod 스키마에 먼저 추가한다. 선택 키는 `default('')` → **없으면 그 기능만 503**("미설정") 으로 응답하고 서버는 뜬다. `.env.example`·`render.yaml` 도 갱신(값은 적지 않는다) | `config/env.ts`, `.env.example`, `render.yaml` |
| B-7 | 로그는 pino 구조화 로그. 쿠키·토큰·키는 redact. 개인 정보를 로그에 남기지 않는다 | `utils/logger.ts` |
| B-8 | 예약 작업은 `worker.ts` 의 `schedule()` 로 등록(겹침 방지·결과 로그 포함). 시간은 `Asia/Seoul`. `RUN_JOBS_IN_API=true` 면 API 프로세스 안에서 같이 돌고, 별도 worker 와 **동시에 켜지 않는다**(알림 중복) | `worker.ts`, `server.ts` |
| B-9 | 외부 API 응답은 어댑터(`weather/kma.ts`, `airQuality/airkorea.ts`, `kakao/*`) 안에서만 다루고 내부 DTO 로 변환해서 서비스에 넘긴다 | `services/weather/types.ts` 등 |
| B-10 | 같은 예보는 **격자(nx, ny) 단위로 공유**한다(`ForecastSnapshot`). 사용자마다 따로 수집하지 않는다 | `services/weather/weatherService.ts`, `jobs/collectionJobs.ts` |

### 4-4. 추천 엔진과 AI의 역할 — **가장 중요한 경계**

| 번호 | 규칙 | 📍 |
|---|---|---|
| R-1 | **무엇을 입을지 판단하는 것은 Rule Engine 뿐이다.** 같은 입력이면 항상 같은 출력(결정론). AI 는 옷·우산·마스크 판단을 **바꿀 수 없다** | `rules/outfitEngine.ts` (`recommend()`) |
| R-2 | 엔진 흐름: 외출 구간의 시간별 **체감온도**(기상청식) 평균·최저를 일정 유형 가중치로 섞음 → + 개인 체감(추위 −2/더위 +2) + 후기 보정(기온대별, ±3 한도) + 일정 보정 → **판단 기온** → 필요 보온 점수 → 옷장 조합(상의×하의×겉옷 0~1) 중 보온 충족 + 방풍/방수/색 궁합/최근 추가 옷/다양성 순으로 선택 | `rules/outfitEngine.ts`, `rules/feelsLike.ts`, `config/ruleConfig.ts` |
| R-3 | **실제 데이터만 쓴다.** 예보가 없으면 `WAITING`. Mock 을 몰래 섞지 않는다. 외부 장애 시 마지막 저장 예보(`stale=true`)는 쓰되, 아무것도 없으면 `WEATHER_UNAVAILABLE` | `services/weather/weatherService.ts` |
| R-4 | 옷장에 맞는 옷이 없으면 일반 추천(`owned:false`, `clothingId:null`), 부족하면 가장 가까운 보유 조합 + `insufficientWardrobe:true`. 온보딩 예시 옷(`isSample`)은 확인 전까지 "내 옷"으로 추천하지 않는다 | `recommendationService.ts` (`toWardrobe`), `schema.prisma` `Clothing.isSample` |
| R-5 | 사용자 요청("올블랙으로", "정장") 해석은 **규칙 사전 먼저**, 못 풀 때만 AI 가 구조화(`Wish`)한다. 해석된 요청은 날씨 한계 안에서만 반영하고, 옷장에 없으면 "예시"(`example:true`)로 보여준다 | `rules/outfitWish.ts`, `rules/outfitStyle.ts`, `services/ai/stylist.ts` |
| R-6 | 면접·결혼식·장례·데이트 같은 **상황 금기**는 규칙으로 처리한다(AI 아님) | `rules/outfitStyle.ts` |
| R-7 | `decisionKey`(`상의_하의_겉옷_UMB_MASK`) 가 같으면 같은 추천 `id` 를 재사용한다(피드백이 안정적으로 붙음) | `recommendationService.ts` |
| R-8 | **Gemini(AI)의 역할은 4가지로 한정**: ① 추천 결과의 **설명 문장**(`explain.ts`, 실패하면 템플릿 문장) ② **사진으로 옷 등록**(`clothingVision.ts`) ③ **말로 일정 등록** 중 규칙이 못 푼 날짜 등(`eventParse.ts`) ④ **코디 도우미 말투·선택지**(`stylist.ts`) | `services/ai/*` |
| R-8a | **자동 설명은 만들 때의 조건을 같이 저장**한다(`Recommendation.aiExplanationMeta` = `{source: ai/template, basis}`; basis = 기온대(5°C 단위)·비·우산·외출 구간). 보여줄 때 현재 추천과 비교해 다르면 **재생성하지 않고 템플릿**을 보여 준다. 템플릿으로 저장된 설명은 항상 현재 추천 기준 템플릿을 보여 준다. 메타 없는 예전 설명은 그대로 신뢰. 오늘 추천의 외출 구간은 `now` 에 맞춰 밀리므로 시작 시각은 비교에 쓰지 않는다. 응답에 `aiExplanationSource` 추가 | `services/ai/explainBasis.ts`, `recommendationService.ts` (`viewOf`, `storedOf`) |
| R-9 | AI 호출은 **`geminiJson()` 한 곳**을 통한다: 응답은 항상 `responseSchema` + **zod 로 재검증**, 실패는 `AI_FAILED`(502), 모든 호출은 `AiCallLog`(성공/실패/지연/사용자/종류)에 기록. AI 가 채운 값은 **사용자가 확인한 뒤에만 저장**한다 | `services/ai/gemini.ts` |
| R-10 | AI 가 꺼져 있거나(`AI_ENABLED`, 키, 모델 중 하나라도 비면 꺼짐) 실패해도 **핵심 기능은 동작**해야 한다(템플릿/규칙 대체, 직접 입력 가능). 사진 인식 전용 모델은 `GEMINI_PHOTO_MODEL`(없으면 `GEMINI_MODEL`) | `aiEnabled()` in `explain.ts`, `config/env.ts` |
| R-11 | **AI 한도 3단**: ① 사용자당 **시간당** 60회(사진/말 따로 집계, `aiLimits.ts`) ② 사용자당 **하루**(최근 24h) 사진 120·말 150, 가입 24시간 내는 300/200 ③ **서버 전체 하루** `AI_GLOBAL_DAILY`(3000) 초과 시 AI 를 모두에게 닫음(`503 AI_BUSY`, 직접 입력·칩은 계속 열림). 수치는 env 로 조정. ④ **자동 설명**은 사진·말과 별도 풀(`AI_EXPLAIN_DAILY`, 사용자당 24h 20회)이고 서버 전체 상한에는 합산. 걸리면 AI 를 부르지 않고 템플릿 문장을 저장(에러 아님). 동시 요청은 프로세스 메모리의 진행 중 카운터(`reserveExplain`)로 막음 — 서버가 여러 대가 되면 DB 로 옮길 것 | `api/middleware/aiLimits.ts`, `services/ai/aiQuota.ts`, `aiScope.ts`, `config/env.ts` |
| R-12 | 사진은 **분석에만 쓰고 저장하지 않는다.** 크기 한도: 요청 1MB(`/api/ai`만), 디코딩 후 700KB, JPG/PNG/WEBP | `api/routes/ai.ts` |
| R-13 | **캐릭터 칭호는 규칙으로 계산**한다(AI 아님). 옷장의 색·종류·무늬·두께 비율로 20종 중 결정, 이유(`reason`)를 함께 낸다 | `services/character/analysis.ts` |

---

## 5. 로그인과 데이터 저장

### 5-1. 로그인

| 번호 | 규칙 | 📍 |
|---|---|---|
| L-1 | 방식은 **카카오 로그인 + 게스트(둘러보기)** 두 가지. 구글/애플은 `AuthProvider` enum 에 값만 추가하면 되는 구조지만 **구현하지 않았다** | `routes/auth.ts`, `schema.prisma` |
| L-2 | **세션 쿠키**(`wb.sid`): HttpOnly · SameSite=Lax · 운영에서 Secure · 30일. 저장소는 PostgreSQL `session` 테이블. 토큰/JWT 를 localStorage 에 저장하지 않는다 | `app.ts` |
| L-3 | 프론트는 **모든 요청에 `credentials:'include'`**. 이는 `api()` 가 알아서 한다. `fetch` 를 직접 쓰지 않는다 | `frontend/src/api.ts` |
| L-4 | 개발: Vite 가 `/api` 를 `localhost:4000` 으로 프록시. 배포: Vercel rewrite 가 `/api/*` 를 Render 로 넘긴다 → **브라우저에서는 항상 같은 출처**라 쿠키·CORS 문제가 없다 | `frontend/vite.config.ts`, `frontend/vercel.json` |
| L-5 | 카카오: 서버가 `/api/auth/kakao` 로 state 를 만들어 리다이렉트 → 콜백에서 state 1회용 검증 → 세션 재생성(fixation 방지) → `FRONTEND_ORIGIN/home` 으로 이동. 실패는 `/?login=failed&reason=…`. 카카오 토큰은 저장하지 않는다. **카카오 개발자 콘솔의 Redirect URI 는 "REST API 키" 설정에 등록**하고 `KAKAO_CLIENT_SECRET` 을 Render 에 넣어야 한다 | `routes/auth.ts`, `services/kakao/kakaoAuth.ts`, `docs/auth.md` |
| L-6 | 게스트는 서버에 실제 User 를 만든다(`POST /api/auth/guest`). 게스트가 카카오 로그인을 하면 **처음 보는 카카오 계정일 때만** 기존 데이터에 연결한다(이미 있는 계정이면 병합 없이 그 계정으로 로그인) | `routes/auth.ts` |
| L-7 | 프론트의 로그인 판단: 앱이 뜨면 `GET /api/me`. **401 = 로그아웃 상태**, 그 밖의 오류(네트워크·500) = `connectError`(다시 시도 화면, 로그아웃으로 오해하지 않음). 첫 접속은 `POST /api/onboarding/complete {skip:true}` 로 **자동 온보딩**(첫 설정 화면 없음) | `frontend/src/auth.tsx`, `App.tsx` |
| L-8 | 로그아웃·탈퇴 시 **이 기기의 푸시 구독을 먼저 해제**한다 | `auth.tsx` (`disablePush`) |
| L-9 | 관리자: `/admin` 은 `ADMIN_PASSWORD` 로 로그인(12시간 세션) 또는 `User.isAdmin`. 비밀번호가 비어 있으면 비밀번호 로그인은 꺼진다 | `middleware/common.ts` (`requireAdmin`) |
| L-10 | 상태 변경 요청(POST/PUT/PATCH/DELETE)은 `Origin` 이 있으면 `FRONTEND_ORIGIN` 과 같아야 한다(아니면 403) | `middleware/common.ts` (`originGuard`) |
| L-11 | IP 기준 요청 제한(`RATE_LIMITED 429`): guest·kakao·geocode 등 | `routes/auth.ts`, `routes/user.ts` |

### 5-2. 데이터 저장

| 번호 | 규칙 | 📍 |
|---|---|---|
| S-1 | **서비스 데이터는 서버 DB 가 원본**이다(설정·옷장·일정·후기·캐릭터 꾸미기·즐겨찾기·푸시 구독). 프론트는 서버 응답을 그대로 쓰고 로컬에 복제 저장하지 않는다 | `backend/prisma/schema.prisma` |
| S-2 | 프론트 `localStorage` 는 **클라이언트 전용 편의값**(소개 본 여부 등)에만 쓴다. 읽고 쓸 때는 `readStored`/`useStored` 를 쓴다(예외 무시) | `frontend/src/store.ts` |
| S-3 | `frontend/src/mocks/*` 는 이름과 달리 **실제 상수 목록**(옷 종류·색 이름·일정 종류)이 들어 있다. 예시 데이터가 아니라 선택지 정의이므로 지우지 않는다 | `mocks/clothes.ts`, `events.ts`, `weather.ts` |
| S-4 | 한도: 옷 500벌, 일정 1000개, 즐겨찾기 10곳(`409 FAVORITES_LIMIT`) | `routes/clothes.ts`, `events.ts`, `places.ts` |
| S-5 | 옷 삭제는 **soft delete**(`active=false`). 회원 탈퇴(`DELETE /api/me`)는 **모든 데이터 삭제**(되돌릴 수 없음). 단 `AiCallLog` 는 삭제하지 않고 **FK `ON DELETE SET NULL` 로 userId 만 비운다**(서버 전체 상한·관리자 집계 유지, 탈퇴·재가입으로 상한 우회 방지). AI 호출 기록은 `services/ai/aiLog.ts` 의 `recordAiCall` 로만 쓴다(탈퇴 중 끝난 호출은 FK 위반 시 userId 없이 재기록) | `routes/clothes.ts`, `routes/auth.ts` |
| S-6 | 사용자 기록 테이블: `CollectLog`(수집), `NotifyLog`(푸시), `AiCallLog`(AI 호출), `AppReview`, `SupportMessage`. 운영 요약은 `GET /api/admin/ops/summary`, `/api/admin/dashboard` | `schema.prisma`, `routes/admin.ts` |
| S-7 | 백업: `backend/scripts/backup-db.sh` → `backups/*.dump`(git 제외). 복원 절차는 `docs/backup-restore.md` | `backend/scripts/` |

---

## 6. API 요청·응답과 오류 처리

### 6-1. 요청/응답 공통 규칙

| 번호 | 규칙 | 📍 |
|---|---|---|
| P-1 | 기준 경로 `/api`. JSON 본문 한도 100KB(`/api/ai` 만 1MB). 성공은 `200/201`(본문) 또는 `204`(본문 없음) | `app.ts` |
| P-2 | 값은 **프론트가 쓰는 한국어 문자열 그대로** 주고받는다(`"반팔"`, `"추위 많이 탐"`). 내부 enum 변환은 서버가 한다(B-2) | `config/mappings.ts` |
| P-3 | 날짜/시간은 KST 문자열(`YYYY-MM-DD`, `HH:mm`). 시각이 필요한 곳은 ISO(UTC) 문자열(`forecastIssuedAt` 등) | `utils/time.ts` |
| P-4 | **필드 추가는 하위 호환**(프론트가 무시해도 동작). 이름 변경·삭제·타입 변경·필수화는 프론트와 함께(1-2). 선택 필드는 프론트 `types.ts` 에서 `?` 로 표기 | `frontend/src/types.ts` |
| P-5 | 프론트의 API 호출은 **`api<T>(method, path, body?)`** 한 함수. 화면 데이터 로딩은 `useAsync(fetcher, key)`(늦게 도착한 이전 응답은 무시) | `api.ts`, `hooks.ts` |
| P-6 | 응답 모양은 `frontend/src/types.ts` 에 타입으로 둔다(`Me`, `ApiWeather`, `ApiRecommendation`, `EventOutfit` …). 새 응답은 서버 직렬화(`services/serializers.ts`)와 함께 맞춘다 | `types.ts`, `serializers.ts` |
| P-7 | 응답에 **색·스타일 정보를 넣지 않는다**(그림은 프론트가 그린다). 예외: 사용자 옷의 `color` 이름 | – |
| P-8 | 예보가 없을 때는 오류가 아니라 `200 { status:'waiting', recommendation:null, message }` (일정 outfit). 오늘 날씨는 `stale`/`dust:null` 처럼 **부분 실패를 필드로** 알린다 | `routes/events.ts`, `routes/weather.ts` |
| P-9 | 다른 지역 추천(즐겨찾기/검색)은 저장하지 않아 `id:null` → 피드백 불가 | `routes/weather.ts` |
| P-10 | **API 를 바꾸면 `docs/api.md` 를 같이 고친다**(백엔드 담당). 현재 문서가 일부 엔드포인트를 빼먹고 있다 → HANDOFF 알려진 문제 | `docs/api.md` |

### 6-2. 오류 형식 (고정)

모든 오류 응답은 **`{ "code": "SOME_CODE", "message": "사용자에게 보여줄 한국어 문장" }`** 하나뿐이다. 스택 트레이스는 운영에서 내보내지 않는다.

📍 서버: `utils/errors.ts`(`AppError`, `badRequest`, `unauthorized`, `forbidden`, `notFound`), `api/middleware/common.ts`(`errorHandler`) / 프론트: `api.ts`(`ApiError`, `errorMessage`)

### 6-3. 오류 코드 (현재 코드에서 확인된 것)

| 상태 | code | 의미 / 화면 처리 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 입력 오류(zod·JSON 파싱 실패 포함) |
| 401 | `UNAUTHORIZED` | 로그인 필요 → 프론트는 로그아웃 상태로 보고 `/start` 로 보낸다(`auth.tsx`, `Protected`) |
| 403 | `FORBIDDEN` | 권한 없음 / 허용되지 않은 Origin |
| 404 | `NOT_FOUND` | 없음(**남의 데이터도 404** 로 숨긴다) |
| 409 | `LOCATION_UNRESOLVED`, `FAVORITES_LIMIT`, `FEEDBACK_EXISTS`, `ALREADY_REVIEWED` | 위치 미해석 / 즐겨찾기 한도 / 중복 피드백 / 이미 후기 작성 |
| 413 | `PAYLOAD_TOO_LARGE` | 본문 너무 큼 |
| 422 | `LOCATION_NOT_FOUND` | 위치를 못 찾음 → "위치를 찾지 못했어요" |
| 429 | `RATE_LIMITED` | IP 제한 |
| 429 | `PHOTO_RATE_LIMITED`, `AI_RATE_LIMITED` | AI 시간당 한도 (메시지에 "몇 분 뒤" 포함) |
| 429 | `PHOTO_DAILY_LIMIT`, `AI_DAILY_LIMIT` | AI 하루 한도 |
| 400 | `LIMIT_REACHED` | 옷 500벌 / 일정 1000개 상한 |
| 401 | `BAD_PASSWORD` | 관리자 비밀번호 불일치 |
| 409 | `CHARACTER_LOCKED` | 옷이 `MIN_CLOTHES`(10)벌 미만이라 캐릭터 꾸미기 불가 |
| 422 | `NOT_CLOTHING` | 사진에서 옷을 못 찾음 |
| 422 | `REGION_UNSUPPORTED` | 중기예보 구역을 못 찾는 지역 |
| 429 | `TOO_MANY` | 문의 하루 전송 한도 |
| 502 | `CALENDAR_UNREACHABLE`, `KAKAO_TOKEN_FAILED`, `KAKAO_PROFILE_FAILED`, `AIR_UPSTREAM_ERROR` | 캘린더 주소 / 카카오 / 에어코리아 실패 (`AIR_*` 는 서버 내부에서 잡아 `dust:null` 로 처리) |
| 503 | `AIR_NOT_CONFIGURED` | 에어코리아 키 미설정 |
| 500 | `INTERNAL_ERROR` | 서버 오류(상세는 서버 로그만) |
| 502 | `WEATHER_UPSTREAM_ERROR`, `WEATHER_UNAVAILABLE`, `GEOCODE_UNAVAILABLE`, `AI_FAILED` | 외부 서비스 실패 |
| 503 | `AI_BUSY` | 서버 전체 AI 일일 상한 도달 |
| 503 | `AI_DISABLED`, `WEATHER_NOT_CONFIGURED`, `KAKAO_NOT_CONFIGURED` | 키 미설정(기능만 꺼짐) |
| (프론트) 0 | `NETWORK_ERROR` | 서버 연결 불가(`api()` 가 만든다) |

> ❓ 위 표는 코드에서 뽑은 현재 상태다. 전체 목록을 한곳에서 관리하는 파일은 없다(11번).

### 6-4. 오류 처리 규칙

| 번호 | 규칙 | 📍 |
|---|---|---|
| E-1 | 서버: 사용자에게 보일 수 있는 오류는 **`AppError(status, CODE, 한국어 문장)`** 으로 던진다. 일반 `Error` 는 500 으로 바뀌고 내용은 숨겨진다 | `utils/errors.ts` |
| E-2 | 서버: `message` 는 **그대로 화면에 보여도 되는 말투**(D-9)로 쓴다. 내부 정보(SQL, 키, 스택)를 넣지 않는다 | – |
| E-3 | 서버: 코드(`code`)는 **대문자 스네이크**, 한 번 정하면 바꾸지 않는다(프론트가 분기에 쓴다). 새 코드는 HANDOFF 의 "프론트 연결 사항"에 적는다 | – |
| E-4 | 프론트: 오류를 보여줄 때 `errorMessage(e)` 를 쓴다(서버 `message` 사용, 없으면 기본 문장). `catch {}` 로 **조용히 삼키지 않는다**(의도적인 경우 이유 주석) | `api.ts` |
| E-5 | 프론트: `code` 로 분기하는 곳은 지금 AI 한도(`isPhotoLimit`: `PHOTO_RATE_LIMITED`, `PHOTO_DAILY_LIMIT`, `AI_BUSY`)와 후기(`ALREADY_REVIEWED`)뿐이다. 나머지는 메시지를 그대로 보여준다 | `lib/ai.ts`, `lib/reviews.ts` |
| E-6 | 프론트: 렌더 중 예외는 `ErrorBoundary`, 서버 연결 실패는 `ConnectError`(다시 시도 버튼) | `ErrorBoundary.tsx`, `App.tsx` |
| E-7 | AI 한도에 걸리면 막지 말고 **언제 풀리는지 + 지금 할 수 있는 일(직접 입력)** 을 같이 보여준다 | `LimitNotice.tsx`, `lib/useAiUsage.ts` |
| E-8 | 외부 API 실패는 **가능한 한 부분 성공**으로 처리한다(미세먼지 실패 → `dust:null` 로 날씨는 정상, 마스크는 "모름") | `services/weather/weatherService.ts` |

---

## 7. 검증 (공통 명령)

작업 종류에 맞는 것만 **실제로 실행**하고 결과를 기록한다. (Windows PowerShell 기준)

| 변경 | 명령 | 비고 |
|---|---|---|
| 프론트 | `cd frontend; npx tsc --noEmit -p tsconfig.app.json` · `npm run lint` · `npm run build` | 보이는 변경은 개발 서버로 직접 확인 (`.claude/launch.json` 의 `frontend` 5180, `backend` 4000) |
| 백엔드 | `cd backend; npm run typecheck; npm run lint; npm test` | **전용 테스트 DB 필요**: `backend/.env` 의 `TEST_DATABASE_URL`(이름에 `test` 포함, 개발 DB 와 달라야 함). 없으면 vitest 가 시작을 거부한다 |
| 새 마이그레이션 | 개발 DB: `npm run prisma:deploy` · 테스트 DB: `$env:DATABASE_URL='<test db>'; npm run prisma:deploy` | 양쪽 모두 적용해야 테스트 통과 |
| 문서만 | 링크·경로가 실제로 있는지 확인 | 서비스 코드는 건드리지 않는다 |

- 통합 테스트는 외부 API 를 전부 Mock 하며 테스트 DB 에 데이터를 남긴다. 백엔드 테스트가 전체 실행 시 가끔 1개 파일만 실패했다가 재실행하면 통과한 적이 있다(원인 미확인) → 한 번 더 돌려보고, 그래도 실패하면 진짜 실패로 기록한다.
- Windows 에서 `npx prisma generate` 가 `EPERM … query_engine` 으로 실패하면 개발 백엔드 서버(4000)를 먼저 끈다.
- `docker-compose.yml` 로 로컬 PostgreSQL 을 띄울 수 있다(`docker compose up -d postgres`, 루트 `.env` 필요).

---

## 8. 환경변수 (이름만 — 값은 어디에도 적지 않는다)

📍 정의: `backend/src/config/env.ts`, 예시: `backend/.env.example`, 배포: `render.yaml`

필수: `DATABASE_URL`, `SESSION_SECRET`(16자 이상) / 배포 필수: `FRONTEND_ORIGIN`, `NODE_ENV=production`
기능별(없으면 해당 기능만 503): `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`, `KAKAO_LOCAL_REST_API_KEY` · `KMA_SERVICE_KEY`, `AIRKOREA_SERVICE_KEY` · `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` · `AI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_PHOTO_MODEL`
AI 한도: `AI_PHOTO_DAILY`, `AI_TEXT_DAILY`, `AI_PHOTO_NEWUSER`, `AI_TEXT_NEWUSER`, `AI_NEWUSER_HOURS`, `AI_EXPLAIN_DAILY`, `AI_GLOBAL_DAILY`
운영: `RUN_JOBS_IN_API`, `SERVE_FRONTEND_DIR`, `ADMIN_PASSWORD`, `DISCORD_WEBHOOK_URL`, `LOG_LEVEL`, `PORT`, `TZ`
테스트 전용: `TEST_DATABASE_URL`

---

## 9. 보안·개인정보 (공통)

- 비밀값은 `.env`/Render 대시보드에만. 코드·문서·로그·채팅에 적지 않는다. 키를 읽어야 하는 작업이면 이름만 확인한다.
- 사용자 사진은 저장하지 않는다(R-12). 개인정보를 새로 수집·저장하게 되면 `frontend/src/pages/legalText.ts` 의 개인정보 문구가 맞는지 확인하고 사용자에게 알린다.
- 남의 데이터 접근은 404 로 응답한다(존재 여부를 숨김).
- 운영자: 박용빈, 문의 ybxxyb5959@gmail.com (`legalText.ts`).

---

## 10. 문서 지도

| 문서 | 위치 | git | 내용 / 상태 |
|---|---|---|---|
| `PROJECT_RULES.md` | 루트 | 포함 | **이 문서** — 규칙 |
| `HANDOFF.md` | 루트 | 포함 | 현재 상태, 알려진 문제, 다음 작업, **작업 기록** |
| `CLAUDE.md` / `AGENTS.md` | 루트 | 포함 | Claude Code / Codex 가 시작 시 읽는 안내 |
| `docs/api.md` | 로컬 전용 | 제외 | API 명세. **일부 누락**(`/api/ai`, `/character`, `/calendar`, `/reviews`, `/support`, 관리자 일부) |
| `docs/backend-architecture.md` | 로컬 전용 | 제외 | 백엔드 구조·Rule Engine. 대체로 맞음. 일부 수치는 `ruleConfig.ts` 가 최신 |
| `docs/auth.md` | 로컬 전용 | 제외 | 로그인 설계 |
| `docs/external-apis.md`, `deployment.md`, `backup-restore.md` | 로컬 전용 | 제외 | 외부 API / 배포 초안 / 백업 |
| `docs/FRONTEND_INTEGRATION.md` | 로컬 전용 | 제외 | **과거 기록**(Mock→API 교체 안내). 지금 코드와 다른 부분 많음 |
| `docs/HANDOFF_NEXT_STEPS.md` | 로컬 전용 | 제외 | **과거 인수인계(2026-10-02)**. "커밋되지 않았다" 같은 내용은 이미 낡음. 배포 절차(A)·백로그(C)는 참고 가치 있음 |
| `BACKEND_HANDOFF.md` | 루트 | 제외 | **가장 오래된 문서**("백엔드는 아직 없다" 시점). 데이터 모델 초안일 뿐 현재와 다름 |
| `backend/README.md`, `deploy/lightsail/README.md` | 각 폴더 | 포함 | 로컬 실행 / Lightsail 배포 |
| `docs/incidents/` | 로컬 전용 | 제외 | 장애 기록 형식(`YYYY-MM-DD-제목.md`) |

과거 문서는 **지우지 않고 그대로 둔다.** 낡은 부분을 발견하면 새 내용은 이 문서/`HANDOFF.md` 에 쓴다.

---

## 11. ❓ 아직 결정되지 않은 내용 (임의로 정하지 말고 사용자에게 물을 것)

| # | 항목 | 현재 상태 | 관련 📍 |
|---|---|---|---|
| U-1 | **캐릭터 잠금(10벌) 방침** | 코드에는 구현돼 있다(커밋 `716140c`: 직접 담은 옷 10벌부터 칭호·꾸미기 열림). 그런데 2026-10-03 메모에는 "잠금/스트릭은 폐기, 모든 아이템은 전원 개방, 정식 출시 때 다시"라고 되어 있다. **어느 쪽이 최종인지 확인 필요** | `analysis.ts` `MIN_CLOTHES`, `lib/character.ts` |
| U-2 | **웹푸시 재개 시점** | 베타 동안 의도적으로 꺼 둠(`PUSH_ENABLED=false`). Render 무료 서버는 15분 유휴 시 잠들어 예약 알림이 안 간다. 재개 방식(핑으로 깨우기 vs Lightsail 이전) 미정 | `frontend/src/config/features.ts`, `render.yaml`, `worker.ts` |
| U-3 | **다크 테마** | 라이트 전용. 삼성 인터넷 강제 다크가 색을 뒤집는 문제는 알려진 한계로 두고 PWA 고도화 때 진짜 다크 테마를 하기로 함. 그때 색 하드코딩(잉크 `#222` 약 61곳, 종이 `#fcfcfa` 약 54곳)을 CSS 변수로 바꿔야 함 | `global.css`, 여러 SVG 컴포넌트 |
| U-4 | **포인트 색 토큰화** | 붉은색·파랑·노랑 등이 토큰 없이 직접 적혀 있음. 팔레트로 정리할지 미정 | `global.css`, `components/*` |
| U-5 | **폰트 자체 호스팅** | 지금은 Google Fonts 의존 | `index.html` |
| U-6 | **오류 코드 목록 문서화** | 코드마다 흩어져 있음. 한 파일/표로 모을지 미정 | 6-3 |
| U-7 | **Google 캘린더 연동** | 지금은 iCal 비공개 주소 붙여넣기. 설정 화면에서는 "준비중"으로 막아 둠. OAuth 방식은 구글 앱 심사 필요(미정) | `CalendarConnect.tsx`, `routes/calendar.ts` |
| U-8 | **성별/스타일 설정** | 성별 설정이 없어 치마를 일반 추천에서 뺌(옷장에 있으면 쓰임) | `outfitEngine.ts` (`genericWardrobe`) |
| U-9 | **구독/결제** | `User.plan(FREE\|PREMIUM)` 필드만 있고 기능 없음 | `schema.prisma` |
| U-10 | **스토어 앱(APK/네이티브 푸시)** | 미정. 하게 되면 웹푸시 대신 FCM/APNs 필요 | `docs/deployment.md` |
| U-11 | **서버 호스팅 최종안** | 현재 Render 무료 + Vercel + Neon. Lightsail 이전은 준비만 돼 있음 | `render.yaml`, `deploy/lightsail/` |
| U-12 | **약관·개인정보처리방침 법률 검토** | 일반 문구 초안 | `legalText.ts` |
| U-13 | **테스트 DB 접속값 공유 방식** | 각자 `backend/.env` 의 `TEST_DATABASE_URL` 로 설정(값은 공유하지 않음) | `backend/vitest.config.ts` |
| U-14 | **이 문서의 갱신 책임** | 지금은 "바꾼 사람이 갱신" | – |
