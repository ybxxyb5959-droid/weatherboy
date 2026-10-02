# API 명세

- Base: `/api` (헬스체크는 `/health`, `/ready`)
- 인증: HttpOnly 쿠키 세션(`wb.sid`). 프론트는 `fetch(..., { credentials: 'include' })`. "Auth: 필요" 는 로그인(Guest 포함) 세션 필요.
- 에러 형식(공통): `{ "code": "VALIDATION_ERROR", "message": "입력값을 확인해주세요." }` (운영에서 stack trace 미반환)
- 공통 에러 코드: `UNAUTHORIZED 401` · `FORBIDDEN 403` · `NOT_FOUND 404` · `VALIDATION_ERROR 400` · `RATE_LIMITED 429` · `INTERNAL_ERROR 500`
- 상태 변경 요청(POST/PUT/PATCH/DELETE)은 `Origin` 헤더가 있으면 `FRONTEND_ORIGIN` 과 같아야 한다(아니면 403).
- 값 표기는 frontend 한국어 문자열 그대로(`mappings.ts` 에서 내부 enum 과 변환).

## Health

| | |
|---|---|
| `GET /health` | Auth 불필요. `200 { "ok": true }` (프로세스 생존) |
| `GET /ready` | Auth 불필요. DB 정상 `200 { "ok": true, "database": "connected" }`, 장애 `503 { "ok": false, "database": "disconnected" }` |

## Auth

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/auth/kakao` | 불필요 | – | `302` → Kakao 로그인 (state 를 세션에 저장) | `503 KAKAO_NOT_CONFIGURED` |
| `GET /api/auth/kakao/callback?code&state` | 불필요 | Kakao 가 호출 | 성공: `302` → `FRONTEND_ORIGIN/setup`(온보딩 전) 또는 `/home`. 실패: `302` → `FRONTEND_ORIGIN/?login=failed&reason=denied|state_mismatch|kakao_error` | `503 KAKAO_NOT_CONFIGURED` |
| `POST /api/auth/guest` | 불필요 | – | `201 Me`. 이미 세션이 있으면 `200` 으로 기존 Me | `429` |
| `POST /api/auth/logout` | 불필요 | – | `200 { ok: true }` (세션 파기, 쿠키 삭제) | – |
| `GET /api/me` | 필요 | – | `200 Me` | `401` |
| `DELETE /api/me` | 필요 | – | `204`. **회원 탈퇴**: 옷장/일정/즐겨찾기/추천/후기/푸시 구독/로그인 연결을 모두 삭제하고 다른 기기 세션도 끝낸다(되돌릴 수 없음) | `401` |

`Me`: `{ id, provider: "KAKAO"|"GUEST", nickname, profileImageUrl, plan: "FREE"|"PREMIUM", onboardingDone }`

Guest 로 쓰던 세션에서 Kakao 로그인을 완료하면 기존 User 에 Kakao 가 연결되어 옷장/일정/피드백이 유지된다(이미 다른 User 에 연결된 Kakao 계정이면 그 User 로 로그인).

## Onboarding / Settings / Location

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `POST /api/onboarding/complete` | 필요 | `{ sensitivity?, location?, notifyEvent?, notifyChange?, closetMode?: "sample"\|"empty", skip?: boolean, place? }` | `200 { onboardingDone: true, settings }` | `400`, `422 LOCATION_NOT_FOUND` |
| `GET /api/settings` | 필요 | – | `200 Settings` | `401` |
| `PUT /api/settings` | 필요 | `{ sensitivity?, location?, notifyEvent?, notifyChange?, place? }` (부분 갱신) | `200 Settings` | `400`, `422 LOCATION_NOT_FOUND` |
| `GET /api/geocode?q=` | 필요 | 쿼리 `q` (1~100자) | `200 [{ name, address, latitude, longitude, regionSido, regionDistrict }]` | `400`, `429`, `503/502 GEOCODE_UNAVAILABLE` |

- `Settings`: `{ sensitivity: "추위 많이 탐"|"보통"|"더위 많이 탐", location, locationResolved, notifyEvent, notifyChange }`
- `closetMode`: `sample` = 프론트 `initialClothes` 11벌 생성(이미 옷이 있으면 중복 생성 안 함), `empty` = 생성 안 함. 기본 `sample`.
- **"나중에 할게"**: `{ "skip": true }` → 기본 설정(서울 마포구, 보통, 알림 켬) + 예시 옷장으로 `onboardingDone=true`. (프론트의 현재 skip 동작 = 기본값 + 예시 옷 유지 와 동일)
- `place`: `/api/geocode` 결과의 `{ latitude, longitude, regionSido, regionDistrict }` 를 그대로 보내면 서버가 재검색하지 않는다. 없으면 서버가 Kakao Local 로 검색(결과 없음 → 422). Kakao 키가 없거나 장애일 때는 프론트 빠른 선택 4곳(서울 마포구/강남구/부산 해운대구/제주시)만 내장 좌표로 해석하고, 그 외는 이름만 저장되고 `locationResolved=false`(날씨 API 가 `409 LOCATION_UNRESOLVED`).
- 위치는 좌표 → 기상청 격자(nx, ny) 로 변환되어 저장된다.

## Places (자동완성 / 즐겨찾기)

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/places/suggest?q=` | 필요 | `q` (최대 30자) | `200 [{ name, sido, district }]` 최대 8개. 내장 지역 목록(시/도 + 시/군/구) 접두 검색. 예: `서` → `서울`, `서울 서대문구`, `서울 서초구` … | `400`, `429` |
| `GET /api/places/reverse?lat=&lng=` | 필요 | 현재 위치(GPS 좌표, 한국 범위) | `200 { name, sido, district, latitude, longitude }` 예: `{ name: "서울 마포구", ... }`. 카카오 좌표→행정구역 변환. 광주/전남 통합 이름은 서비스 지역 이름으로 정리, `수원시 영통구` → `수원시` | `400`(범위 밖), `422`(바다 등), `503/502` |
| `GET /api/favorites` | 필요 | – | `200 Favorite[]` | `401` |
| `POST /api/favorites` | 필요 | `{ name, place? }` (`name` 은 지역 이름. 서버가 카카오로 좌표/격자를 구해 저장) | `201 Favorite` (이미 있으면 `200` 으로 기존 항목) | `422 LOCATION_NOT_FOUND`, `409 FAVORITES_LIMIT`(10곳) |
| `DELETE /api/favorites/:id` | 필요 | – | `204` | `404` (남의 즐겨찾기 포함) |

`Favorite`: `{ id, name, address, latitude, longitude, regionSido, regionDistrict }`

## Weather

| Method Path | Auth | Response | Error |
|---|---|---|---|
| `GET /api/weather/today[?favoriteId=|place=]` | 필요 | 아래. `favoriteId`(내 즐겨찾기) 또는 `place`(지역 이름)를 주면 그 지역의 날씨. 없으면 내 기본 위치 | `409 LOCATION_UNRESOLVED`, `503 WEATHER_NOT_CONFIGURED`, `502 WEATHER_UPSTREAM_ERROR / WEATHER_UNAVAILABLE` |

```json
{
  "location": "서울 마포구",
  "temp": 12, "feels": 9, "rainChance": 20,
  "tempMin": 8, "tempMax": 19,
  "wind": { "speed": 4.2, "label": "약간 강함" },
  "dust": { "pm10": 35, "pm25": 18, "grade": "보통" },
  "condition": "cloudy", "flags": ["range"],
  "feelsMethod": "WINTER_WINDCHILL",
  "stale": false, "forecastIssuedAt": "2026-10-01T02:00:00.000Z"
}
```
- `dust` 는 AirKorea 실패/미설정이면 `null` (날씨는 정상 반환).
- `condition` 은 실제 확보한 데이터로 근거가 있는 값만. 단기예보에 없는 `thunder / fog / uv / typhoon` 은 생성하지 않는다. `stale=true` 는 새 수집이 실패해 마지막 저장 예보를 쓴 경우.

## Recommendation

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/recommendations/today[?favoriteId=|place=]` | 필요 | – | `200 Recommendation`. 다른 지역 추천은 **저장하지 않아 `id: null`** (피드백 불가) | 위 Weather 와 동일 |
| `POST /api/recommendations/:id/feedback` | 필요 | `{ rating: "추웠어요"\|"딱 좋아요"\|"더웠어요", period?: "MORNING"\|"DAY"\|"EVENING", actualTemperature? }` | `201 { ok: true }` | `400`, `404`(남의 추천 포함), `409 FEEDBACK_EXISTS` |

```json
{
  "id": "uuid",
  "items": [{ "clothingId": "uuid|null", "type": "맨투맨", "color": "회색", "label": "회색 맨투맨", "owned": true }],
  "needOuter": true, "needUmbrella": false, "needMask": false, "maskDataAvailable": true,
  "headline": "좀 쌀쌀해요", "sub": "겉옷 챙기는 게 좋아요",
  "reasons": ["…"], "alternatives": [[{ "…": "items 와 같은 형식" }]],
  "insufficientWardrobe": false, "aiExplanation": null,
  "forecastStage": "SHORTTERM", "version": 1
}
```
- 옷은 사용자의 옷장(`owned: true`)에서 고른다. 옷장에 상의/하의가 없으면 일반 타입 추천(`owned: false`, `clothingId: null`, `color: "기타"`). 옷장은 있으나 보온이 부족하면 가장 가까운 보유 조합 + `insufficientWardrobe: true`.
- `maskDataAvailable=false` 면 미세먼지 데이터가 없어 `needMask=false` 는 "모름" 의미.
- 같은 날 같은 판단(decisionKey)이면 같은 `id` 를 재사용한다(피드백이 안정적으로 붙음).

## Clothes

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/clothes` | 필요 | – | `200 Clothing[]` | `401` |
| `POST /api/clothes` | 필요 | `{ type, thickness, color, windproof?, waterproof? }` | `201 Clothing` | `400` |
| `PATCH /api/clothes/:id` | 필요 | 위 필드 일부 | `200 Clothing` | `400`, `404` |
| `DELETE /api/clothes/:id` | 필요 | – | `204` (soft delete: `active=false`) | `404` |

`Clothing`: `{ id, type, thickness, color, windproof, waterproof }`. category/warmth 는 서버가 계산(입력 불가).
`type`: 반팔·긴팔·맨투맨·니트·후드티·바지·반바지·치마·바람막이·자켓·코트·패딩 / `thickness`: 얇음·보통·두꺼움 / `color`: 검정·회색·흰색·베이지·초록·파랑·기타.

## Events

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/events` | 필요 | – | `200 Event[]` (시작일 오름차순) | |
| `POST /api/events` | 필요 | `{ title, startDate, endDate?, startTime?="09:00", endTime?="18:00", place?="", kind, placeHint? }` | `201 Event` | `400`, `422 LOCATION_NOT_FOUND` |
| `GET /api/events/:id` | 필요 | – | `200 Event` | `404` |
| `PATCH /api/events/:id` | 필요 | 위 필드 일부 | `200 Event` (예보 조건이 바뀌면 WAITING 으로 초기화) | `400`, `404` |
| `DELETE /api/events/:id` | 필요 | – | `204` | `404` |
| `GET /api/events/:id/outfit` | 필요 | – | 아래 | `404` |

`Event`: `{ id, title, startDate, endDate?, place, startTime, endTime, kind: "여행"|"캠핑"|"등산"|"야외활동"|"기타", status: "waiting"|"ready", forecastStage: "WAITING"|"MIDTERM"|"SHORTTERM", locationResolved }` (`endDate` 는 시작일과 다를 때만). 날짜/시간은 KST.

`GET /api/events/:id/outfit`:
- 예보 없음: `200 { status: "waiting", forecastStage: "WAITING", recommendation: null, message: "아직 정확한 예보가 없어요." }` (404/500 아님)
- 예보 있음: `200 { status: "ready", forecastStage: "SHORTTERM"|"MIDTERM", recommendation: Recommendation, message: null }`
- 장소가 비어 있으면 사용자 기본 위치의 예보를 사용한다. 중기예보(MIDTERM)는 일별 최저/최고·강수확률만 있어 근사치다(`reasonCodes` 에 `MIDTERM_APPROX`).

## Push

| Method Path | Auth | Request | Response | Error |
|---|---|---|---|---|
| `GET /api/push/public-key` | 필요 | – | `200 { publicKey: string\|null }` (VAPID 공개키) | |
| `POST /api/push/subscribe` | 필요 | `PushSubscription.toJSON()` = `{ endpoint, keys: { p256dh, auth } }` | `201 { ok: true }` (endpoint 중복은 갱신) | `400` |
| `DELETE /api/push/subscribe` | 필요 | `{ endpoint }` | `204` | `400` |

## Admin (isAdmin=true 만)

| `GET /api/admin/ops/summary` | 필요(관리자) | `{ windowHours: 24, collect: {SUCCESS,FAILED,PARTIAL}, push: {SENT,FAILED,SKIPPED}, ai: { calls, fallbacks }, recentErrors: [...] }` | `401`, `403` |
|---|---|---|---|

## Rate Limit

`/api/auth/guest` 20/분, `/api/auth/kakao` 20/분, `/api/auth/kakao/callback` 30/분, `/api/geocode` 30/분 (IP 기준). 초과 시 `429 RATE_LIMITED`. AI(Gemini)는 외부로 노출된 엔드포인트가 없고 서버 내부에서 추천 생성 시에만 호출된다.


## 옷(Clothing) 색/무늬
`color`: 검정|회색|흰색|베이지|갈색|카키|초록|네이비|파랑|하늘색|빨강|분홍|주황|노랑|보라|기타, `pattern`: 무지|체크|줄무늬|도트|프린트 (생략하면 무지). 옷 목록과 추천 항목(`items[].pattern`)에 함께 내려간다.
