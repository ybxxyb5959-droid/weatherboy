# 백엔드 인수인계 문서 (프론트엔드 MVP 기준)

앱: **날씨 + 일정 + 개인 체감 + 내 옷장**으로 "오늘 뭐 입을지" 추천하는 모바일 우선 웹앱/PWA.
현재 `frontend/` (React + Vite + TypeScript + react-router-dom)는 **전부 Mock 데이터 + localStorage**로 동작한다.
백엔드는 아직 없다. 이 문서의 모델/엔드포인트는 프론트 코드에서 그대로 뽑은 것이다.

## 0. 작업 범위 / 제약

- 해야 할 일: `backend/` 신규 구성 + 프론트가 쓰는 Mock을 API로 교체할 수 있게 계약(contract) 제공.
- 프론트 코드는 `frontend/src/mocks/*`, `frontend/src/store.ts`에 Mock/저장소가 분리되어 있다. 이 부분만 API 호출로 바꾸면 된다.
- UI는 "도화지에 볼펜 낙서" 컨셉이라 응답에 색상/스타일 정보는 필요 없다. 프론트가 그림을 그린다.
- 사진 업로드, AI 이미지 인식, 결제는 **범위 밖**(옷 등록은 버튼 선택 방식).
- 언어: UI 문자열이 한국어 enum 값이다. enum은 아래 표기 그대로 주고받을 것(또는 코드값 ↔ 한글 매핑을 합의).

## 1. 인증 (현재는 Mock)

프론트 인트로 화면: `카카오톡으로 시작하기`, `로그인 없이 둘러보기`(게스트) **두 가지만** 둔다. (구글/애플은 추후 앱 출시·해외 사용자 대응 시 추가 예정)
현재는 localStorage `auth = { provider: 'kakao'|'guest', at: number }`만 저장한다.

필요한 것:
- 카카오 OAuth 로그인 → 자체 세션/JWT 발급. (Provider 구조는 구글/애플을 나중에 추가할 수 있게 확장 가능하게 설계)
- 게스트: 서버 계정 없이 사용하거나 임시 계정 발급 후 나중에 소셜 계정에 연결(merge) 가능하게.
- `POST /api/auth/kakao` (code 또는 access_token 교환), `POST /api/auth/guest`, `POST /api/auth/logout`, `GET /api/me`.
- 구독/결제 기능 예정이므로 User에 `plan`(free|premium) 필드 여지를 둘 것.

## 2. 앱 흐름 (라우팅)

```
/            인트로(로그인 버튼) → 로그인 후 setup-done 이면 /home, 아니면 /setup
/setup       첫 설정(위치, 개인 체감, 알림, 옷장 시작 방식) → 완료 시 /home
/home        오늘 추천 (메인)
/wardrobe    내 옷장 (카테고리별 빨랫줄)
/wardrobe/add 옷 추가
/events      내 일정
/events/new  일정 등록
/events/:id  일정 상세 (날씨 대기중 / 옷차림 생성됨, D-10 → D-3 → D-1)
/settings    설정
/weather     날씨 낙서 미리보기(개발용, 백엔드 불필요)
```

localStorage 키(= 서버로 옮길 상태):

| 키 | 내용 | 서버 대응 |
|---|---|---|
| `intro-seen` | 인트로 통과 여부 | 불필요(클라이언트) |
| `setup-done` | 첫 설정 완료 여부 | `User.onboardingDone` |
| `auth` | 로그인 정보 Mock | 세션/JWT |
| `settings` | 설정 객체 | `/api/settings` |
| `clothes` | 옷 배열 | `/api/clothes` |
| `events` | 일정 배열 | `/api/events` |
| `feedback-today` | 오늘 추천 피드백 문자열 | `/api/recommendations/:id/feedback` |

## 3. 데이터 모델

### Settings
```ts
type Sensitivity = '추위 많이 탐' | '보통' | '더위 많이 탐'
interface Settings {
  sensitivity: Sensitivity   // 슬라이더 아님. 3택1
  location: string           // 예: '서울 마포구' (텍스트 입력 + 빠른 선택)
  notifyEvent: boolean       // 일정 알림
  notifyChange: boolean      // 예보 변경 알림
}
```
기본값: `{ sensitivity:'보통', location:'서울 마포구', notifyEvent:true, notifyChange:true }`.
`location`은 현재 자유 텍스트다. 서버에서 **행정구역/좌표로 지오코딩**(기상청 격자 nx,ny 변환 포함)해야 하고, 실패 시 사용자에게 알릴 에러 규격이 필요하다.

### Clothing (옷)
```ts
interface Clothing {
  id: string
  type: string        // 아래 12종
  thickness: '얇음' | '보통' | '두꺼움'
  color: '검정'|'회색'|'흰색'|'베이지'|'초록'|'파랑'|'기타'
  windproof: boolean  // 방풍
  waterproof: boolean // 방수
}
```
`type` 12종: `반팔, 긴팔, 맨투맨, 니트, 후드티, 바지, 반바지, 치마, 바람막이, 자켓, 코트, 패딩`.
옷장 UI 카테고리(서버 로직에도 쓰기 좋음):
- 상의: 반팔·긴팔·맨투맨·니트·후드티
- 하의: 바지·반바지·치마
- 가벼운 겉옷: 바람막이·자켓
- 코트·패딩: 코트·패딩

첫 설정에서 "예시 옷으로 시작 / 빈 옷장으로 시작"을 고른다. 예시 옷은 프론트 `mocks/clothes.ts`의 11벌이며, 서버 seed로 줄 수도 있다.

### PlanEvent (일정)
```ts
type EventKind = '여행' | '캠핑' | '출근·등교' | '운동·산책'
type EventStatus = 'waiting' | 'ready'   // 날씨 대기중 | 옷차림 생성됨
interface PlanEvent {
  id: string
  title: string
  startDate: string   // YYYY-MM-DD
  endDate?: string
  place: string
  startTime: string   // HH:mm
  endTime: string
  kind: EventKind
  status: EventStatus
}
```
- 신규 일정은 `waiting`으로 시작. 예보 가능 시점(기상 예보 범위)에 도달하면 서버가 옷차림을 생성하고 `ready`로 바꾸고 푸시를 보낸다.
- 일정 상세 타임라인: **D-10 예보 시작 → D-3 상세 예보 → D-1 최종 확인**. 서버 스케줄러가 이 시점에 예보를 갱신/재계산해야 한다.
- 현재 폼은 단일 날짜 입력(종료일은 Mock 데이터에만 있음). 서버는 `endDate` 허용.

### Weather (오늘의 날씨)
```ts
interface Weather {
  location: string
  temp: number         // °C
  feels: number        // 체감 °C
  rainChance: number   // 강수확률 %
  wind: string         // 현재 '약간 강함' 같은 텍스트 → 서버는 수치(m/s) + 등급 문자열 둘 다 주면 좋음
  dust: string         // '보통' 등 → 등급 문자열(좋음/보통/나쁨/매우나쁨) + 수치 PM10/PM2.5
}
```
추가로 필요: `condition: WeatherKind`, 아침/낮 온도(일교차 표시용), 자외선 지수.

### WeatherKind (날씨 상태 enum, 프론트 아이콘 18종)
```
clear 맑음, cloudy 흐림, partly 구름 조금, rain 비, thunder 번개, snow 눈, windy 바람 센 날,
dust 미세먼지, fog 안개, heat 폭염, cold 한파, shower 소나기, sleet 진눈깨비,
range 일교차 큰 날, uv 자외선 강함, frost 빙판·서리, typhoon 태풍, night 밤
```
서버가 기상 원자료에서 **하나의 대표 `condition`**(필요하면 보조 `flags[]`)을 산출해 내려주면 프론트는 그림만 고른다.
(예: 폭염/한파는 체감온도 기준, dust는 PM 등급, range는 일교차 임계값 등. 임계값은 서버에서 정의.)

### Recommendation (오늘 추천)
```ts
interface OutfitItem { label: string; type: string; color: string } // label 예: '경량패딩', type은 Clothing.type
interface Recommendation {
  id: string
  items: OutfitItem[]       // 추천 조합 (현재 2벌, 사용자 옷장에서 고르는 것이 이상적)
  needOuter: boolean        // 겉옷 O/X
  needUmbrella: boolean     // 우산 O/X
  needMask: boolean         // 마스크 O/X
  headline: string          // '좀 쌀쌀해요'
  sub: string               // '겉옷 챙기는 게 좋아요'
  reasons: string[]         // '왜 이 추천?' 목록
}
```
- "다른 조합 보기": 대안 조합 배열을 순환한다(현재 기본 1 + 대안 2). 서버는 `alternatives: OutfitItem[][]`를 같이 주거나 `?offset=`으로 다음 조합을 주면 된다.
- `reasons`에는 개인 체감(`sensitivity`) 영향 문장이 포함되도록(예: 추위를 많이 타서 한 겹 더).
- 피드백: `추웠어요 | 딱 좋아요 | 더웠어요`. 누적해서 개인 보정에 쓰는 것이 목표.

### 추천 로직 가이드(초안)
입력: 체감온도, 강수확률, 바람, 미세먼지, 자외선, 일교차, 개인 체감 오프셋(추위 −/더위 +), 보유 옷(두께·방풍·방수), 피드백 이력.
출력: 위 Recommendation. 보유 옷이 없으면(빈 옷장) 타입 단위의 일반 추천(`label`만)으로 대체.

## 4. 필요한 API (제안)

공통: JSON, `Authorization: Bearer <token>`, 에러는 `{ code, message }`.

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/auth/kakao` | 카카오 로그인 |
| POST | `/api/auth/guest` | 게스트 시작 |
| GET | `/api/me` | 사용자 + onboardingDone |
| GET/PUT | `/api/settings` | Settings 조회/저장 (첫 설정 저장 포함) |
| POST | `/api/onboarding/complete` | 첫 설정 완료 (옷장 시작 방식 `sample`/`empty` 포함) |
| GET | `/api/weather/today` | 오늘 날씨 (설정 위치 기준) |
| GET | `/api/recommendations/today` | 오늘 추천 + 대안 조합 |
| POST | `/api/recommendations/{id}/feedback` | 추웠어요/딱 좋아요/더웠어요 |
| GET/POST/DELETE | `/api/clothes` | 옷 목록/추가/삭제 |
| GET/POST | `/api/events` | 일정 목록/추가 (+PUT/DELETE 있으면 좋음) |
| GET | `/api/events/{id}` | 일정 상세 + status |
| GET | `/api/events/{id}/outfit` | 일정 옷차림(ready일 때) |
| GET | `/api/geocode?q=` | 위치 검색/자동완성 (설정·첫 설정의 위치 입력용) |
| POST | `/api/push/subscribe` | Web Push 구독 등록 |

백그라운드 작업(worker):
- 일정 D-10/D-3/D-1 예보 갱신 및 `waiting → ready` 전환.
- 예보 변경 감지 시 `notifyChange`가 켜진 사용자에게 푸시.
- 일정 알림은 `notifyEvent`가 켜진 사용자에게.
- Push 문구 예: "제주 여행 옷차림이 생성되었어요! 확인하러 갈까요?"

## 5. 외부 연동 후보

- 날씨: 기상청 단기/중기예보(OpenAPI), 에어코리아(미세먼지). 대안 OpenWeather.
- 소셜 로그인: Kakao (추후 Google, Apple).
- 푸시: Web Push (VAPID). PWA service worker는 프론트에서 추후 추가.

## 6. 프론트에서 교체해야 할 지점 (참고)

- `src/mocks/weather.ts` → `/api/weather/today`, `/api/recommendations/today`
- `src/mocks/clothes.ts`(initialClothes) → `/api/clothes`
- `src/mocks/events.ts`(initialEvents) → `/api/events`
- `src/store.ts`의 `useStored(...)` 호출들(`settings`, `clothes`, `events`, `feedback-today`) → API 훅으로 교체
- `src/pages/IntroPage.tsx`의 Mock 로그인 → OAuth
- 홈의 날씨 그림은 현재 클릭 시 18종을 순환하는 미리보기 장치가 들어 있다(`HomePage.tsx`의 `kindIdx`). 실제 연동 시 `weather.condition`으로 대체.

## 7. GPT에게 줄 요청 프롬프트 (예시)

> 첨부한 `BACKEND_HANDOFF.md`와 `frontend/` 소스를 읽고, 이 프론트엔드가 쓰는 데이터 모델과 API 계약에 맞는 백엔드를 `backend/` 아래에 구성해줘.
> 1) 먼저 기술 스택 선택안(예: FastAPI+PostgreSQL 또는 NestJS)과 폴더 구조, DB 스키마(ERD), OpenAPI 스펙을 제안해.
> 2) 내 확인 후 인증 → 설정/옷장/일정 CRUD → 날씨/추천 → 스케줄러/푸시 순으로 구현해.
> 3) 프론트 코드는 수정하지 말고, 바꿔야 할 지점은 목록으로만 알려줘.
> 4) enum 값은 문서의 한국어 표기를 그대로 사용하거나, 코드값↔한글 매핑 표를 함께 제시해.
