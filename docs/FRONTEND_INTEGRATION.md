# Frontend 연결 가이드

> **상태(2026-10-02): 아래 1~5번은 `frontend/` 에 적용 완료.** 새 파일: `src/api.ts`(fetch 도구), `src/auth.tsx`(세션 기반 로그인 상태), `src/hooks.ts`(`useAsync`), `src/types.ts`(API 응답 타입). `vite.config.ts` 에 `/api` 프록시 추가.
> 백엔드 `FRONTEND_ORIGIN` 은 프론트 주소(개발: `http://localhost:5180`)와 같아야 한다(Origin 검사, Kakao 로그인 후 redirect).
> 홈 화면에는 지역 검색 토글(자동완성 + 즐겨찾기)이 있다: `components/LocationBar.tsx`, `/api/places/suggest`, `/api/favorites`, `/api/weather/today?favoriteId=|place=`.
> 설정은 메뉴 목록 + 하위 화면(`/settings/:section`: location, sensitivity, notify, account, faq, terms, privacy, about) 구조다. 약관/개인정보처리방침/FAQ 문구는 `pages/legalText.ts` 의 **초안**이므로 운영자 정보를 채우고 법률 검토 후 사용한다. 회원 탈퇴는 `DELETE /api/me`.
> **위치/알림 허용:** 첫 설정과 설정>내 위치의 `LocationPicker`(`현재 위치로 찾기` → 브라우저 위치 허용 팝업 → `/api/places/reverse`), 알림은 `PushToggle` + `lib/push.ts` + `public/sw.js`(서비스워커) + `/api/push/public-key`/`subscribe`. 알림 켜기를 누르면 허용 팝업이 뜬다. 앱(스토어) 배포 시에는 웹푸시 대신 네이티브 푸시(FCM/APNs)가 필요하다 — docs/deployment.md 참고.
> 6번(Web Push, service worker)과 로그아웃 UI, 옷 삭제 UI 는 아직 없다.

아래는 교체 지점 설명(참고용)이다.

## 0. 공통

- 모든 요청에 `credentials: 'include'` (HttpOnly 쿠키 세션). JWT/토큰을 localStorage 에 저장하지 않는다.
- 개발: Vite proxy 로 `/api` → `http://localhost:4000` 를 쓰면 같은 Origin 이 되어 쿠키/CORS 이슈가 없다.
  ```ts
  // vite.config.ts
  server: { proxy: { '/api': 'http://localhost:4000' } }
  ```
  프록시 없이 `5173 → 4000` 직접 호출도 가능(백엔드 CORS 가 `FRONTEND_ORIGIN` + credentials 허용). 이때 Kakao 콜백 redirect 대상(`FRONTEND_ORIGIN`)과 맞춰야 한다.
- 에러는 `{ code, message }`. `401` 이면 인트로(`/`)로 보낸다.
- localStorage 의 `intro-seen` 은 그대로 클라이언트 전용. `setup-done`, `auth`, `settings`, `clothes`, `events`, `feedback-today` 는 서버 상태로 대체한다.

## 1. `src/pages/IntroPage.tsx`

| 현재 | 교체 |
|---|---|
| `enter('kakao')` 가 localStorage `auth` 저장 | `window.location.href = '/api/auth/kakao'` (백엔드가 Kakao → 콜백 → `/setup` 또는 `/home` 으로 redirect). 실패 시 `/?login=failed&reason=…` 로 돌아오므로 인트로에서 쿼리를 읽어 안내 |
| `enter('guest')` | `await fetch('/api/auth/guest', { method: 'POST', credentials: 'include' })` → 응답 `Me.onboardingDone` 으로 `/setup` 또는 `/home` 이동 |
| 시작 시 `readStored('setup-done')` | 앱 부팅 시 `GET /api/me`. 401 → 인트로, `onboardingDone === false` → `/setup`, `true` → `/home` |

로그아웃 UI 는 아직 없지만 `POST /api/auth/logout` 이 준비되어 있다.

## 2. `src/pages/SetupPage.tsx`

`finish(skip)` 를 `POST /api/onboarding/complete` 로 교체.

```ts
// 시작하기
{ sensitivity: sens, location, notifyEvent, notifyChange,
  closetMode: closet === '예시 옷으로 시작' ? 'sample' : 'empty' }
// 나중에 할게
{ skip: true }
```
- 위치 입력은 가능하면 `GET /api/geocode?q=` 로 후보를 보여주고, 선택한 후보의 `{ latitude, longitude, regionSido, regionDistrict }` 를 `place` 로 함께 보낸다. 빠른 선택 4곳은 키 없이도 서버가 해석한다.
- 응답 `422 LOCATION_NOT_FOUND` → "위치를 찾지 못했어요" 안내.
- 성공하면 `/home`. 서버가 `setup-done` 을 관리하므로 `setup-done` localStorage 는 불필요.

## 3. `src/store.ts` 와 `useStored` 호출부

`useStored(key, fallback)` 는 localStorage 훅이다. 키별 교체:

| 키 / 사용처 | 교체 |
|---|---|
| `settings` (`SettingsPage`, `SetupPage`, `HomePage`) | `GET /api/settings`, `PUT /api/settings` (부분 갱신 가능, `patch()` 와 호환). 응답에 `locationResolved` 추가됨 |
| `clothes` (`WardrobePage`, `AddClothingPage`, `SetupPage`) | `GET /api/clothes`, `POST /api/clothes`(id 는 서버 UUID, `c${Date.now()}` 제거), 삭제는 `DELETE /api/clothes/:id` |
| `events` (`EventsPage`, `NewEventPage`, `EventDetailPage`) | `GET/POST /api/events`, `GET /api/events/:id`. `status: 'waiting'\|'ready'` 호환 유지. `NewEventPage` 의 `id = e${Date.now()}` 제거 |
| `feedback-today` (`HomePage`) | `POST /api/recommendations/:id/feedback` (id 는 `GET /api/recommendations/today` 응답의 `id`). 같은 추천에 중복 피드백은 `409` |

타입(`Settings`, `Clothing`, `PlanEvent`)은 서버 응답과 필드명이 같다. 서버 id 는 문자열(UUID).

## 4. `src/mocks/weather.ts` → 날씨/추천 API

`HomePage` 가 쓰는 `todayWeather`, `todayRecommendation`, `alternativeOutfits` 교체.

### `GET /api/weather/today`
기존 `Weather` 타입과 달라지는 점:

| 필드 | 기존 | 서버 |
|---|---|---|
| `wind` | `string` ('약간 강함') | `{ speed: number, label: string }` → 화면은 `w.wind.label` |
| `dust` | `string` ('보통') | `{ pm10, pm25, grade } \| null` → 화면은 `w.dust?.grade ?? '정보 없음'` (AirKorea 실패 시 null) |
| (신규) | | `condition: WeatherKind`, `flags[]`, `tempMin`, `tempMax`, `stale` |

### `GET /api/recommendations/today`
기존 `Recommendation` 대비 변경/추가:
- `id` 추가(피드백용), `items[]` 에 `clothingId`, `owned` 추가 (`label/type/color` 유지)
- `alternatives: OutfitItem[][]` 를 응답이 함께 준다 → `alternativeOutfits` mock 제거, `altIdx` 순환은 `rec.alternatives` 로
- `needMask` 는 서버 Rule(미세먼지 "나쁨" 이상)로 결정. mock 값과 다를 수 있다(의도).
- `insufficientWardrobe`, `maskDataAvailable`, `aiExplanation` 추가(선택 표시)
- 옷장에 상의/하의가 없을 때 `items[].owned === false` 인 일반 추천이 온다 → "옷장에 없는 옷이에요" 같은 표시를 고려
- `HomePage` 의 `sensNote`(개인 체감 문구)는 서버 `reasons` 에 이미 포함되므로 중복되면 제거

### 날씨 낙서 Preview (`HomePage.tsx` 의 `kindIdx`)
개발용 Preview(클릭 시 18종 순환)는 유지해도 되지만, 실제 화면은 `weatherKinds.find(k => k.kind === weather.condition)` 로 고정한다. 서버는 근거 있는 값만 내려주므로 `thunder / fog / uv / typhoon` 은 오지 않는다.

## 5. 일정 상세 `EventDetailPage.tsx`

`GET /api/events/:id/outfit` 를 호출해 하드코딩된 `sample`(긴팔+바람막이+우산)을 대체:
- `status: 'waiting'` → 지금처럼 "아직 정확한 예보가 없어요" + 예시 표시
- `status: 'ready'` → `recommendation.items` + `needUmbrella` 로 그림. `forecastStage` 가 `MIDTERM` 이면 "대략적인 예보" 안내 권장
- D-10/D-3/D-1 타임라인은 안내용 UI 이고, 서버는 실제 예보 데이터 유무로 단계를 정한다.
- 날짜/시간은 KST 문자열(`startDate`, `startTime`…) 그대로 사용. 기존 `dDay()` 는 클라이언트 로컬 시간 기준이다.

## 6. Push (`PushMock.tsx` 이후)

PWA service worker 추가 시:
1. `GET /api/push/public-key` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
2. 구독 객체를 `POST /api/push/subscribe` (`subscription.toJSON()` 그대로)
3. 서버 payload: `{ title, body, url }` → service worker `push` 이벤트에서 `showNotification(title, { body, data: { url } })`, `notificationclick` 에서 `url` 로 이동.
4. 알림을 끄면 `DELETE /api/push/subscribe { endpoint }`.

## 7. 확인 필요(백엔드 계약 메모)

- `/setup` 의 "나중에 할게" = `{ skip: true }`. 설정 기본값은 서버가 채운다.
- `PUT /api/settings` 에서 위치만 바꿔도 격자/지역이 다시 계산된다.
- 먼 미래 일정은 `waiting` 이 정상(예보가 열릴 때까지). 서버 Worker 가 상태를 갱신하고 `notifyEvent/notifyChange` 에 따라 Push 한다.
