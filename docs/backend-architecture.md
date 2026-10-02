# Backend 아키텍처

```
Browser(PWA) ──/api──▶ Nginx ──▶ API (Express)  ──▶ PostgreSQL (Prisma)
                                   │                    ▲
                                   ▼                    │
                          Kakao / KMA / AirKorea        │
                                                        │
                     Worker (node-cron, 별도 프로세스) ─┘ ──▶ Web Push
```

## 디렉터리 (`backend/src`)
| 경로 | 역할 |
|---|---|
| `app.ts` / `server.ts` / `worker.ts` | Express 조립 / API 진입점 / 스케줄러 진입점 |
| `api/routes/*` | auth, user(settings·onboarding·geocode), clothes, events, weather(+recommendations), push, admin |
| `api/middleware/common.ts` | 인증/관리자 가드, Origin 가드, zod 파싱, 에러 핸들러 |
| `config/` | `env`(zod 검증), `mappings`(한글↔enum 단일 지점), `ruleConfig`(모든 추천 수치), `sampleClothes` |
| `rules/` | `outfitEngine`(결정론적 추천), `feelsLike`(기상청 체감온도), `clothing`(warmth/category 계산) |
| `services/` | `kakao/`, `weather/`(KMA 어댑터·캐시·condition), `airQuality/`, `push/`, `ai/`, `recommendationService`, `location` |
| `jobs/` | `collectionJobs`(weather/airQuality), `eventForecastJob`, `pushNotificationJob` |

## 핵심 원칙
1. **추천 판단은 Rule Engine 만** — 같은 입력이면 같은 출력. Gemini 는 설명 문장 전용이며 Rule 결과 JSON 만 입력으로 받고 실패하면 템플릿으로 대체한다.
2. **실제 데이터만** — 예보가 없으면 `WAITING`. Mock 을 숨겨 반환하지 않는다. 외부 장애 시 마지막 저장 예보(`stale`)는 쓰되, 아무것도 없으면 오류(`WEATHER_UNAVAILABLE`).
3. **예보는 격자 단위로 공유** — `ForecastSnapshot(gridNx, gridNy, source, issuedAt, targetAt)` unique. 사용자별 중복 수집 없음.
4. **Provider 경계** — 외부 응답은 `WeatherProvider`/`AirQualityProvider` 안에서만 다루고 내부 DTO 로 변환.

## Rule Engine (MVP Draft 수치는 `config/ruleConfig.ts`)
1. 외출 구간의 시간별 체감온도(기상청식)에서 평균과 최저를 일정 유형별 가중(출근 0.3 / 여행 0.5 / 캠핑 0.7 / 운동 0.3)으로 섞는다.
2. 판단온도 = 위 값 + 개인 체감(추위 −2 / 더위 +2) + 피드백 오프셋(±0.5씩, 한도 ±3) + 일정 유형(캠핑 −2 / 운동 +2).
3. 필요 보온 점수: ≥28℃:1, 23~27:2, 20~22:3, 17~19:4, 12~16:6, 9~11:8, 5~8:10, ≤4:13.
4. 옷 보온 = 타입 기본(반팔1 긴팔2 맨투맨2 후드2 니트3 / 바람막이2 자켓3 코트5 패딩7 / 반바지0.5 치마1 바지2) + 두께(얇음−0.5, 두꺼움+1).
5. 후보 = 상의 1 × 하의 1 × 겉옷 0~1. 보온 합 ≥ 필요량인 조합 중 정렬: 강풍이면 방풍 겉옷 우선 → 비면 방수 겉옷 우선 → 가장 가벼운 합 → 겉옷 없음 우선 → id(결정론).
6. 우산: 외출 구간 중 강수확률 ≥60% 또는 비/눈/소나기. 마스크: AirKorea 등급 ≥ 나쁨(3). 데이터 없으면 마스크 false + `maskDataAvailable=false`.
7. 옷장 부족: 보유 옷 중 보온이 가장 높은 조합 + `insufficientWardrobe=true`. 상의/하의가 아예 없으면 일반 타입 추천(`owned=false`).
8. `decisionKey = 상의_하의_겉옷_UMB0|1_MASK0|1` (타입 기준). 기온 숫자가 조금 변해도 같은 조합이면 같은 키.

## Worker (`npm run dev:worker`)
| Job | 스케줄(KST) | 내용 |
|---|---|---|
| `weatherCollectionJob` | 02,05,08,11,14,17,20,23시 :15 | 사용자·곧 있을 일정이 쓰는 격자의 단기예보 수집 |
| `airQualityCollectionJob` | :20, :50 | 사용자 지역 대기질 |
| `eventForecastJob` | 매시 :25 | 11일 이내 일정의 예보 단계(WAITING/MIDTERM/SHORTTERM) 갱신, 추천 저장, 판단 변경 감지 |
| `pushNotificationJob` | eventForecastJob 안에서 호출 | decisionKey 변경 시 Push |

- 예보 단계는 **실제 데이터 유무**로 결정한다(D-10/D-3/D-1 단순 날짜 계산 아님). 단기예보가 외출 시간을 덮으면 SHORTTERM, 중기예보만 있으면 MIDTERM, 없으면 WAITING.
- Push 규칙: 일정당 최대 3회, 23:00~07:00 KST 금지(야간이면 판단을 보류해 낮에 재시도), 알림 설정 꺼짐이면 기록만, 전송 실패는 최대 3회 재시도 후 `NotifyLog FAILED`, 404/410 구독은 삭제.

## 운영 로그
`CollectLog`(수집), `NotifyLog`(Push), `AiCallLog`(Gemini) + pino 구조화 로그(쿠키/토큰/키 redact). 관리자 요약: `GET /api/admin/ops/summary`.

## DB
PostgreSQL, 시간은 UTC 저장 / 표시는 Asia/Seoul(`utils/time.ts`). 스키마 변경은 Prisma Migration 으로만(`prisma/migrations`). 세션 테이블 `session` 도 Prisma 모델이다. User 는 `plan(FREE|PREMIUM)` 만 두고 결제/광고는 구현하지 않았다.
