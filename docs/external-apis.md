# 외부 API

> 모든 어댑터는 공식 문서 기준으로 작성했다. **실제 키로 호출 검증한 항목은 없다**("코드 구현 완료 / 실제 호출 미검증"). 어댑터 단위 테스트는 응답 파싱·발표시각 계산 등 순수 로직만 대상이다.

| API | 용도 | 키 | 파일 | 상태 |
|---|---|---|---|---|
| Kakao Login | OAuth 로그인 | `KAKAO_REST_API_KEY` `KAKAO_CLIENT_SECRET` `KAKAO_REDIRECT_URI` | `services/kakao/kakaoAuth.ts` | 구현 / 실제 호출 미검증 (Mock Flow 테스트) |
| Kakao Local | 위치 검색 | `KAKAO_REST_API_KEY` | `services/kakao/kakaoLocal.ts` | 구현 / 실제 호출 미검증 |
| 기상청 단기예보 | 시간별 예보 | `KMA_SERVICE_KEY` | `services/weather/kma.ts` | 구현 / 실제 호출 미검증 |
| 기상청 중기예보 | 일별 예보(+3~+10일) | `KMA_SERVICE_KEY` | `services/weather/kma.ts` | 구현 / 실제 호출 미검증 |
| AirKorea | PM10/PM2.5 | `AIRKOREA_SERVICE_KEY` | `services/airQuality/airkorea.ts` | 구현 / 실제 호출 미검증 |
| Web Push(VAPID) | 알림 | `VAPID_*` | `services/push/push.ts` | 구현 / 실제 전송 미검증 |
| Gemini | 설명 문장 | `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_ENABLED` | `services/ai/explain.ts` | 구현 / 실제 호출 미검증 (기본 꺼짐) |

공공데이터포털 키는 Encoding/Decoding 키 어느 쪽을 넣어도 동작하도록 디코딩 후 재인코딩한다.

## Kakao
- 인가: `GET https://kauth.kakao.com/oauth/authorize` (client_id, redirect_uri, response_type=code, state)
- 토큰: `POST https://kauth.kakao.com/oauth/token` (grant_type=authorization_code, client_id, redirect_uri, code, client_secret)
- 사용자: `GET https://kapi.kakao.com/v2/user/me` (Bearer) — `id`, `kakao_account.profile.nickname/profile_image_url`
- Local: `GET https://dapi.kakao.com/v2/local/search/address.json|keyword.json?query=` (`Authorization: KakaoAK {키}`) — `documents[].address_name, x(경도), y(위도)`
- 출처: developers.kakao.com 의 Kakao Login REST API / Local 가이드 (2026-10-01 확인)

## 기상청
- 격자 변환: 기상청 공식 DFS(Lambert Conformal Conic) 예제 상수(RE=6371.00877, GRID=5, SLAT1=30, SLAT2=60, OLON=126, OLAT=38, XO=43, YO=136). 단위 테스트: 서울(60,127), 부산(98,76), 광주(58,74), 대전(67,100).
- 단기예보 `VilageFcstInfoService_2.0/getVilageFcst`: 발표 02·05·08·11·14·17·20·23시, 발표 +10분 후 조회. `TMP POP PTY SKY WSD REH TMN TMX` 사용. PTY 0없음/1비/2비·눈/3눈/4소나기, SKY 1맑음/3구름많음/4흐림.
- 중기예보 `MidFcstInfoService/getMidTa`(기온) + `getMidLandFcst`(강수확률/날씨): 발표 06·18시(`tmFc`), `regId` 필요.
  - **시도 → regId 매핑표는 코드에 내장**(`kma.ts`의 `MID_LAND/MID_TEMP`). 기상청 구역 코드표 기준으로 작성했지만 실제 호출로 확인하지 못했다 → 첫 실서비스 호출 때 반드시 검증. 강원 영동/제주 서귀포 등 세부 분기는 일부만 반영.
  - 중기예보는 시간별 풍속·습도·강수형태가 없어 판단 정확도가 낮다 (바람 0 으로 취급, 강수형태는 날씨 문구에서 추정).
- 체감온도: 기상청 공식식. 여름(5~9월) Stull 습구온도 기반(`습도` 필요), 겨울(10~4월)은 기온 ≤10℃ & 풍속 ≥1.3m/s 일 때만 풍속냉각식(풍속 km/h). 조건 미충족/데이터 없음 → 기온 fallback(`FEELS_FALLBACK_TEMP`).
- 발표 지연, 미제공 시각 등 운영 이슈는 `docs/incidents/` 에 기록.

## AirKorea
- `ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty` (시도별 실시간 측정정보): `sidoName`, `ver=1.3`, `returnType=json`. 응답 `pm10Value/pm25Value/pm10Grade/pm25Grade`(1좋음~4매우나쁨), 결측 `-`.
- 사용자 구/시 이름과 같은 측정소가 있으면 그 값, 없으면 시도 전체 중앙값. 등급이 없으면 환경부 통합 기준(PM10 30/80/150, PM2.5 15/35/75)으로 계산.
- 실패해도 날씨 API 는 성공(dust=null) + `CollectLog PARTIAL`.

## 내부 경계
Controller 는 외부 응답을 직접 파싱하지 않는다. `WeatherProvider` / `AirQualityProvider` 인터페이스(`services/weather/types.ts`)가 내부 DTO(`HourlyForecast`, `DailyForecast`, `AirQualityReading`)를 돌려준다. 같은 격자의 예보는 사용자가 아닌 `ForecastSnapshot` 으로 공유 저장한다(단기 30분 / 중기 3시간 / 대기질 30분 캐시).
