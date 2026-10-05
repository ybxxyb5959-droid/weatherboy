# HANDOFF.md — 현재 상태와 작업 기록

규칙은 `PROJECT_RULES.md`. 이 문서는 **지금 상태 + 다음 할 일 + 작업 기록**. 작업이 끝날 때마다 맨 아래 "작업 기록"에 한 건을 **위에 추가**한다.

## 1. 현재 작업 상태 (2026-10-04, 커밋 `22efa30`, 브랜치 main, 작업 폴더 깨끗)
- 베타 테스트 단계. 배포: Vercel(화면) + Render 무료(API) + Neon(DB). 첫 커밋 2026-10-02, 총 97커밋.
- 담당: **현재 Claude Code 가 프론트·백엔드 모두 구현**, GPT 는 브레인스토밍만 (2026-10-04 사용자 결정). 기본 분담(Claude=프론트, Codex=백엔드)은 `PROJECT_RULES.md` 1번에 남겨 둠.
- 진행 중인 작업 없음.

## 2. 최근 변경 (git log 기준)
- 사진 인식 개선: 걸린 바지/데님/소매·밑단 단서, evidence·confidence, 확신 낮은 항목은 체크 해제로 시작, 상의/하의/겉옷 한 번에 전환, `GEMINI_PHOTO_MODEL` (`22efa30`)
- 캐릭터 잠금 10벌로 상향, 탭·화면에 잠금 표시 (`716140c`)
- 관리자 AI 사용량(일별 호출, 실패율, 평균 응답, 서버 전체 상한, 상위 사용자) (`20480f1`)
- AI 한도: 사진/말 분리, 하루 한도 + 신규 가입 보너스, 서버 전체 `AI_GLOBAL_DAILY`, `/api/ai/usage` + 남은 양 막대 (`290f56c`, `74db917`, `068df46`)
- 코디 도우미: 요청 해석(톤·색), 정장 세트 예시, 며칠짜리 일정별 코디, 캐릭터가 옷장에서 갈아입는 연출
- 칭호 규칙 엄격화, 상황 금기 규칙(면접/결혼식/장례/데이트), 색 궁합, 기온대별 후기 보정

## 3. 알려진 문제
1. **캐릭터 잠금 방침 충돌**: 코드는 10벌 잠금 구현, 메모(2026-10-03)는 "잠금 폐기, 정식 출시 때" → 사용자 확인 필요 (U-1).
2. 웹푸시는 베타 동안 꺼 둠(`PUSH_ENABLED=false`). Render 무료는 유휴 시 잠들어 예약 알림 불가 (U-2).
3. 삼성 인터넷 강제 다크모드가 색을 뒤집음 — 보류 (U-3).
4. `docs/api.md` 에 `/api/ai`, `/character`, `/calendar`, `/reviews`, `/support`, 관리자 일부 누락 (백엔드 담당이 보완).
5. (해결) 오류 코드 표(6-3)에 누락 코드 추가 완료.
6. 문서 규칙 중 코드 줄 번호 참조(`global.css:1327` 등)는 파일이 바뀌면 어긋남 → 작업 시 검색으로 확인.
7. `docs/`, `BACKEND_HANDOFF.md` 는 git 제외라 clone 하면 없음.
8. 백엔드 전체 테스트가 가끔 1개 파일만 실패했다 재실행하면 통과 (원인 미확인).
9. 프론트 번들 약 700KB, oxlint 경고 약 15개, 폰트 Google Fonts 의존.

## 4. 다음 작업 — 베타 전 완성 계획 (사용자+GPT 검토 반영, 2026-10-04)

**목표:** "옷을 조금만 등록해도 추천을 받고, AI 한도나 서버 오류가 생겨도 계속 쓸 수 있는 앱." 구현·테스트는 모두 Claude, GPT 는 의견·검토. 결정: 자동 AI 설명 유지(공통 한도 + 템플릿 대체) / 푸시 베타 동안 끔 / 수익화·캐릭터 해금·새 이펙트 제외 / 한도 수치는 임시 후보(사진 30~60회, 서버 전체 500~1,000회) / 현재 배포(Vercel+Render 무료+Neon)부터 검증. 크기·일정은 추정.

### 베타 시작 전 반드시
| # | 작업 | 선행 | 크기 | 완료 기준 |
|---|---|---|---|---|
| A0 | 범위·인수인계 문서 확정 | 먼저 | 작음 | 결정 사항이 이 문서에 반영됨 (진행 중) |
| A1 | 모델·기능별 AI 사용량(토큰) 기록 | A0 | 중간 | 모델·기능·입출력 토큰·성공/실패 구분. 입력 문장·사진 내용은 기록 안 함 |
| A2 | 모든 AI 호출에 공통 비용 상한(자동 설명 포함) | A1과 함께 | 큼 | 동시 요청·반복 조회로 우회 불가. 초과 시 설명=템플릿, 사진·문장=수동 입력. **예비 테스트용 임시 제한을 먼저 설정**. 사진 장수≠호출 수(스캔 최대 12회), 호출 수만으로 금액 상한이 안 되므로 토큰·출력 길이 제한도 검토 |
| A3 | 오래된 AI 설명 수정 | A2 | 중간 | 같은 조합이어도 날씨·외출 조건이 바뀌면 설명 갱신. 늦게 온 이전 설명이 최신을 덮지 않음. 새로고침마다 AI 재호출 안 함 |
| A4 | 탈퇴 시 AI 기록 삭제/익명화 + 개인정보 안내 일치 | A1 | 중간 | `AiCallLog.userId` 제거, 세션 등 연결 데이터 확인, AI 전송·보관·백업 안내가 실제와 일치 |
| A5 | 예보 발표 시각·미세먼지 측정 시각 표시 | 기존 조회 활용 | 중간 | 발표/측정/조회 시각 구분, 이전 값·지역 대표값·데이터 없음 구분 |
| A6 | 옷 3~5벌 빠른 시작 | 기존 등록 활용 | 중간 | 사진 AI 없이 몇 벌 등록 → 첫 추천. 옷장 부족 시 필요한 옷 안내 + 등록 화면 연결 |
| A7 | 베타용 기능 설정 확인 | A0 | 작음 | **푸시 서버 발송은 `PUSH_ENABLED` 가 아니라 VAPID 환경변수 3개 유무로 결정됨**(`push.ts` `pushConfigured`; 프론트 플래그는 화면만 숨김). Render 에 VAPID 키를 넣지 않거나 서버에서 명시적으로 막아 발송이 없음을 확인. 날씨 수집 작업은 유지 |
| A8 | 변경 기능·로그인·보안 검증 | A1~A7 | 큼 | 빌드·린트·테스트 통과(통합 테스트는 전용 DB), 로그인·저장·탈퇴·남의 데이터 차단 확인, Prisma 보안 경고 3건은 호환성 확인 후 수정 또는 대응 근거 기록 |
| A9 | 실제 날씨 비교(서울·부산·제주·강원) | A5 | 중간 | 공식 값과 시각·기온·강수·미세먼지 대조, 자정 전후·API 실패·오래된 데이터 확인 |
| A10 | 현재 배포·백업·복구 검증 | A8 | 큼 | Vercel→Render→Neon 로그인·저장, 잠들었다 깬 첫 접속 안내, 백업을 **별도 DB 에 복원**, 이전 버전 되돌리기 |
| A11 | 3~5명 예비 테스트·한도 결정 | A2·A8~A10 | 중간 | 호출·토큰 사용량으로 초기 한도 결정, 진행 막는 오류 수정 후 본 베타 초대 |

일정(추정): 1~3일 A0~A2·A4 / 4~7일 A3·A5~A7 / 8~10일 A8~A10 / 11~14일 A11. 문제가 나오면 검증 기간을 늘린다.

### 베타 점검 합의 (Claude 점검 + GPT 의견을 코드와 대조, 2026-10-04, 커밋 `bdef516`)
코드로 확인한 것만 적음. ⚠️ = 실측 필요. ❓ = 사용자 결정 필요.

| 우선 | 항목 | 근거 📍 | 제안 |
|---|---|---|---|
| P0 | "겉옷 없이" 요청이 날씨로 고른 겉옷도 말없이 제거, 예시로 바꾼 옷의 보온 재검증 없음 | `rules/outfitWish.ts` `applyWish` | 최종 조합을 엔진 보온 기준으로 재검증, 부족하면 이유 표시 |
| P0 | 일정 장소를 못 찾으면 사용자 기본 지역으로 조용히 대체 | `recommendationService.ts` `regionOf`, `routes/events.ts` | 응답에 대체 여부 표시 또는 장소 확정 요구 |
| P0 | 세션 쿠키 `rolling` 없음 → 로그인 30일 뒤 만료, 게스트 복구 불가 ⚠️ | `app.ts` | `rolling: true` |
| P0 | `trust proxy 1` + Vercel 경유 → IP 제한 공유 가능 ⚠️ | `app.ts`, 각 `rateLimit` | 운영 로그로 `req.ip` 확인 후 보정 |
| P0 | 후기·문의 **본문**을 Discord 로 전송 | `services/review/notifyOwner.ts` | ❓ 본문 제외(알림만) 또는 개인정보 안내에 명시 |
| P0 | 개인정보 안내: 국외 이전(Gemini), 연령 기준, 탈퇴 후 익명 로그·백업, Discord 전송 미기재 | `legalText.ts` | 실제 처리에 맞춰 전면 정리 + 공개 URL |
| P0 | 콜드스타트 중 빈 화면, 프론트 요청 타임아웃 없음 | `App.tsx`, `api.ts` | 스플래시 + 타임아웃·재시도, 베타 동안 서버 상시화 ❓ |
| P1 | AI 한도: 사진·문장은 조회 후 기록(동시 요청 우회), 전체 상한 30초 캐시, DB 오류 시 허용(fail-open) | `services/ai/aiQuota.ts` | 시간당 제한이 있어 피해는 제한적. 예약 방식 통일 + 오류 시 닫기 |
| P1 | 요청 로그에 URL 쿼리(좌표, 카카오 콜백 code) 기록 | `utils/logger.ts`, `app.ts` pino-http | URL 쿼리 마스킹 |
| P1 | 게스트 버튼 연타 시 게스트 중복 생성 가능, 게스트 정리 작업 없음 | `IntroPage.tsx`, `routes/auth.ts` | 버튼 잠금 + 미사용 게스트 정리 |
| P1 | 캐릭터 모듈 캐시가 로그아웃·계정 전환 때 초기화되지 않음 | `lib/character.ts` | 로그아웃 시 초기화 |
| P1 | 관리자 비밀번호 로그인 시 세션 재생성 없음 | `routes/admin.ts` | `regenerate` |
| P1 | 첫 사용: 위치 건너뛰면 `서울 마포구` 고정, 빈 옷장이면 홈이 추천 대신 등록 안내 | `routes/user.ts:125`, `HomePage.tsx` `needCloset` | ❓ 빈 옷장일 때 일반 추천을 보여줄지(커밋 `ca2f28a` 에서 의도적으로 가린 것) / 기본 지역 표시 |
| P1 | 둘러보기에서 "안 쓸래요" → 울음 → google.com 이동 | `TourPage.tsx` `BYE_URL` | ❓ 연출 유지 여부 |
| P1 | 스토어: 공개 개인정보·계정삭제 URL, `assetlinks.json`, maskable 아이콘, 지표·오류 수집 없음 | `public/`, `vercel.json` | TWA 준비 묶음 |
| – | (과장) 캘린더 SSRF: 사설 IP·DNS 검사가 이미 있음(DNS 재바인딩만 남음) | `services/calendar/ical.ts` | 베타에서 서버 쪽도 끄면 충분 |

외부 확인 필요(코드 밖): Gemini 약관의 연령 제한·무료 등급 데이터 사용 ❓ 성인(만 18세+) 베타로 할지 / Play 대상 API 수준 / 개인 계정 12명·14일 조건 — 등록 시 공식 문서로 재확인.

### 베타 후 / 나중
- 베타 후: 한도·비용 조정, 첫 사용 과정 개선, 사진 인식 개선, 재방문·만족도 확인, 속도·안정성, 수익화 방향 검토
- 나중(필요성 확인 후): 웹푸시 재개(U-2), 결제, 캘린더 확장(베타 포함 여부 미정), 추가 AI 기능, 호스팅 변경
- 이미 구현돼 있어 새로 만들 필요 없음: 추천 엔진, AI 실패 시 템플릿 설명(한도 초과 연결만 필요), 수동 옷 등록, 로그인·탈퇴, 체감 피드백·제보·관리 화면, 캐릭터·공유(기존 것은 유지)

### 베타 초대 판단 기준 (8개 모두 충족)
1. 모든 AI 호출에 공통 상한, 한도 도달 후에도 기본 추천·수동 입력 가능
2. 토큰 사용량 확인 가능, 기록에 입력·사진 내용 없음
3. 탈퇴 후 AI 기록의 식별 정보 제거, 안내와 실제 처리 일치
4. 날씨 변화에 설명이 맞게 바뀌고, 예보·미세먼지 기준 시각 구분
5. 처음 온 사람이 3~5벌로 추천을 받고 로그인·저장·재방문 정상
6. 배포 지연·오류 안내 동작, 푸시 실제 발송 없음, 별도 DB 복원·되돌리기 확인
7. 필요한 테스트 통과, 개인정보 노출·데이터 유실·로그인 불가 없음
8. 3~5명 예비 테스트 완료, 측정 기반 초기 한도·예산, 오류 제보 대응 방법 확정

기타: 알려진 문제 1번(캐릭터 잠금 방침) 확인 / `docs/api.md` 누락 보완 / 다크 테마·폰트 자체 호스팅은 PWA 고도화 때.

## 5. 상대에게 요청
- (없음) 위 4번 표 1~4번은 Claude 가 직접 진행. 검증 항목에 "설명 반복 조회", "동시 요청", "한도 초과 시 템플릿 반환"을 넣을 것.

형식: `[요청자 → 대상] 무엇을/왜/어느 파일`

## 6. 작업 기록 형식 (복사해서 맨 위에 추가)

```
### YYYY-MM-DD 한 줄 제목  (작성: Claude Code | Codex)
- 수정 목적:
- 변경 파일:
  - 경로 — 무슨 변경
- 프론트 연결 사항: (API 필드/에러 코드/enum 추가·변경, 프론트가 해야 할 일. 없으면 "없음")
- 검증 결과: (실행한 명령과 결과만. 못 한 것은 "못 함 + 이유")
- 남은 일 / 상대에게 요청:
- 적용한 규칙 번호: (예: D-9, B-5)
```

## 7. 작업 기록 (최신이 위)

### 2026-10-05 화면별 로딩 장면(졸라맨) 8종 (작성: Claude Code)
- 수정 목적(사용자 결정): 화면 안 "불러오는 중…" 글자만 있던 로딩을 서버 깨우기처럼 화면마다 어울리는 졸라맨 장면으로.
- 변경 파일: `frontend/src/components/LoadingScene.tsx`(신규: 장면 8개 + `<Loading kind label>` — **0.4초가 지나야 나타남**), `styles/motion.css`(`.ls-*`, 움직임 줄이기에서는 마지막 모습으로 정지), 각 화면의 로딩 문구를 `<Loading>` 으로
- 장면: 홈(`weather`: 하늘 보기, 해→구름→비→우산→해), 일정 목록(`calendar`: 달력 넘기고 날짜에 펜으로 동그라미), 일정 상세(`note`: 테이프 두 장 철썩 + 날씨 낙서), 옷장(`closet`: 빨랫줄에 옷 하나씩 걸기, `ClothingArt` 재사용), 캐릭터(`mirror`: 내 캐릭터(꾸민 모습)가 거울 앞에서 한 바퀴), 설정(`gear`: 렌치로 톱니 철컥×3), 후기(`letter`: 편지 쓰고 접어 우체통), 옷·일정 수정(`edit`: 지우개로 지우고 펜으로 다시 쓰기)
- 프론트 연결 사항: 없음.
- 검증 결과: tsc/lint/build 통과. 8개 장면을 임시 데모 화면에 한꺼번에 띄워 진행 중간 모습을 확인(임시 코드는 지움). 실제 각 화면의 로딩에서 나타나는 모습(0.4초 지연)은 못 봄 — 로딩이 빨라 거의 안 보일 수 있음.
- 남은 일 / 상대에게 요청: 관리자 화면(Admin)과 앱 시작(Splash)은 그대로. 캐릭터 장면은 `StickPerson mood="stand"` 라 옷은 입히지 않은 맨 모습에 꾸미기만 나옴.
- 적용한 규칙 번호: A-2

### 2026-10-05 홈: 시간대별 날씨(막대 없이)+일출·일몰, 후기 알림 우측 상단, 다른 조합=옷장 연출 / 일정 상세 글 줄이기 (작성: Claude Code)
- 사용자 요청과 처리:
  1. 홈 "시간대별 날씨": **막대 그래프만 없애고** 시간·아이콘·기온·강수·외출/귀가는 그대로(`HourlyChart`, 지금 칸은 노란 형광펜). 그래프가 있던 자리 아래에 오늘 일출·일몰(`SunBar`): 우리 앱 해(동글납작·점 눈·미소·들쭉날쭉한 햇살), 삐뚤빼뚤한 땅과 점 찍은 길, 지평선에 반쯤 걸린 해, 밤이면 달. 이름은 다시 "시간대별 날씨"(카드 편집 이름도).
  2. "오늘 어땠나요?": 홈 안에 박혀 있던 카드 대신 **화면 오른쪽 위 알림**(말풍선 아이콘+빨간 점, 슬라이드 인)으로 뜨고, 누르면 같은 후기 카드가 팝업으로 열림(남기면 2.4초 뒤 닫힘, 푸시 `?fb=now` 로 들어오면 바로 열림). 푸시 문구는 제목 "오늘 어땠나요?", 내용 "평가를 해주시면 다음에 더 잘 맞출게요"(`dailyPushJob.ts`). 푸시 발송 조건·시점은 그대로(귀가 후, 추천을 봤고 후기를 안 남겼을 때).
  3. 오늘 추천 "다른 조합 보기": 일정 코디 도우미에 쓰던 **옷장 연출**(달려가기→뒤적이기→갈아입기→돌아오기, `WardrobeScene`) 재사용. 입는 졸라맨은 사용자가 꾸민 캐릭터 그대로. 연출 중 버튼 잠금, "움직임 줄이기"면 바로 바뀜.
  4. 일정 상세: 3일 이내로 다가온 일정은 "예보 시작→상세 예보→최종 확인" 줄을 **모든 일정에서** 숨김(먼 일정만 표시). 야외활동 안내는 "야외활동이 적합한지 확인해보세요 / 날씨가 예측되었어요. 바뀔 수 있어요."로, 점수 카드의 설명·미세먼지 주석 문구는 삭제.
- 변경 파일: `HomePage.tsx`, `HourlyChart.tsx`, `SunBar.tsx`, `homeLayout.ts`, `ActivityScore.tsx`, `EventDetailPage.tsx`, `global.css`, `backend/src/jobs/dailyPushJob.ts`
- 프론트 연결 사항: 없음(푸시 문구만 바뀜).
- 검증 결과: 프론트 tsc/lint/build, 백엔드 typecheck·단위 테스트 통과. 브라우저로 시간대별 칸+일출·일몰, 알림 말풍선·팝업, 옷장 연출(dig 단계) 확인. 일정 상세 문구 변경은 화면으로 못 봄.
- 남은 일 / 상대에게 요청: 푸시는 베타 동안 발송 보류 정책이라 문구만 바꿈. 3일 이내 타임라인 숨김이 야외활동뿐 아니라 모든 일정에 적용됨(원치 않으면 `isActivity` 로 좁히기). 커밋 안 함.
- 적용한 규칙 번호: A-2

### 2026-10-05 일정 코디 도우미 제거 + "코디 필요" 체크박스 제거 + 야외활동 점수 + 홈 카드 편집 연출 + 소소한 UI (작성: Claude Code)
- 수정 목적(사용자 결정): 코디 사용자 맞춤(도우미/검색) 고도화는 접고 **정적 추천만**. 일정에서 무엇을 보여줄지는 체크박스가 아니라 **종류+제목**으로 정한다. 러닝·등산 같은 야외 활동은 기능성 운동복을 입으니 옷 대신 **야외활동 점수**(기온·비·바람·미세먼지).
- 규칙(`backend/src/rules/eventMode.ts`): 여행·캠핑 → `outfit`(정적 옷 추천). 등산 → `activity`. 야외활동 → 제목에 러닝·축구·자전거 등 활동 말이 있으면 `activity`, 없으면(피크닉) `outfit`. 기타 → 활동 말이 있으면 `activity`, 아니면 `weather`(날씨만). 헬스·요가·수영 같은 실내 운동은 활동 말에서 뺐다.
- 변경 파일(백엔드): `rules/eventMode.ts`·`rules/activityScore.ts`(신규, 점수 = 기온 35·비 30·미세먼지 20·바람 15 가중 + 한 요인이 아주 나쁘면 상한), `weather/sun.ts`(`sunTimes` 일출·일몰), `routes/events.ts`(`GET /:id/outfit` 이 `status:'activity'` + `activity[]`(날짜별 점수·요인·일출/일몰·한 줄 팁) 응답, `needsOutfit` 입력 제거), `serializers.ts`(`mode` 추가, `needsOutfit` 는 호환용), `recommendationService.ts`(`outfitWanted(kind,title)`), `jobs/eventForecastJob.ts`(옷 일정만 점검), 테스트(`outfitWanted`, `activityScore` 단위)
- 변경 파일(프론트): `EventDetailPage.tsx`(코디 도우미 `EventStylist` 사용 제거 — **파일·백엔드 `/api/ai/event-stylist` 는 남겨 둠**, 야외활동 점수 화면), `ActivityScore.tsx`(신규: 손그림 반원 게이지 + 줄무늬 요인 막대 4개 + 일출·일몰 해 길), `NewEventPage.tsx`("코디 필요" 체크박스 제거), `EventsPage.tsx`(목록 문구 mode 별, 카드 그림을 왼쪽으로 22px 당김), `global.css`(`⋯` 버튼 검정, 점수 카드), `types.ts`, `mocks/events.ts`(`outfitKinds` 제거, `mode`)
- 보완(같은 날): "시간대별 날씨" 그래프는 **홈**의 것이었는데 야외활동 점수 카드의 시간대 막대로 잘못 알아들어 먼저 거기를 바꿨음. 홈은 이제 `HourlyChart` 자리에 **오늘 일출·일몰**(`SunBar.tsx`, 해가 지금 호의 어디쯤인지·일몰까지 남은 시간, 밤이면 달). `GET /api/weather/today` 응답에 `sun`(KST HH:MM) 추가. 홈 카드 편집의 이름은 "일출·일몰"(저장 id 는 `hourly` 그대로). `HourlyChart.tsx`·외출/귀가 표시는 홈에서 쓰지 않음(파일은 남김). 점수 카드는 시간대 막대 대신 일출·일몰 해 길을 그대로 둠. 옷 돌려입기(상의/하의) 버튼도 화면에서 제거.
- 홈 카드 편집(`HomePage.tsx`, `global.css`): ▲▼ 로 옮기면 두 카드가 서로 자리를 바꾸며 미끄러지고(FLIP 0.44s) 옮긴 카드가 잠깐 떠오름. 숨기기는 흑백으로 서서히 줄어들고, 편집을 끝내면 숨긴 카드가 서서히 사라지며 접힘(0.5s), 편집을 다시 시작하면 위에서 내려오며 나타남.
- 프론트 연결 사항: 일정 응답에 `mode`('outfit'|'activity'|'weather') 추가, `outfit` 응답 `status:'activity'` + `activity[]` 추가. 요청 본문 `needsOutfit` 는 이제 무시됨(DB 컬럼은 남겨 둠).
- 검증 결과: 프론트 tsc/lint/build 통과, 백엔드 typecheck/lint/단위 테스트 통과. 브라우저에서 러닝 일정(점수 카드·일출 06:32/일몰 18:09)·홈 카드 이동/숨기기 확인(테스트 일정은 지움). **통합 테스트(`npm test`)는 22개 실패(일정 생성 500 등) — 테스트 DB 에 지난 `needs_outfit` 마이그레이션이 안 들어간 것으로 보이나 확인은 못 함**(테스트 DB 에 `prisma migrate deploy` 필요할 수 있음). 코디 도우미 관련 통합 테스트(`ai.test.ts` 등)는 화면에서 안 쓰는 기능이라 그대로 둠.
- 남은 일 / 상대에게 요청: 미세먼지는 지금 상태라 **오늘 일정에만** 반영(미래 날짜는 정보 없음으로 계산에서 뺌). 점수 가중치·기준값은 초안이니 써 보고 조정. 일출·일몰은 지역 격자 중심 좌표 기준 계산(1~2분 오차). 커밋 안 함.
- 적용한 규칙 번호: A-2, D-9, D-17

### 2026-10-05 로딩 화면 "서버 깨우기" 장면 + 일정 삭제(구겨 밀어내기) 고도화 + 일정 생성(테이프 붙이고 펜으로 쓰기) (작성: Claude Code)
- 수정 목적(사용자 요청): ① 로딩 화면 졸라맨을 "잠든 서버를 깨우는" 움직임으로(제목 "뭐입을옷?" 은 이미 뺌) ② 일정 삭제를 포스트잇 구겨서 옆으로 밀어내는 연출로 ③ 새 일정은 일정 탭에서 테이프로 붙인 뒤 펜으로 적기.
- 변경 파일:
  - `frontend/src/components/WakeScene.tsx`(신규), `Splash.tsx` — 8초 한 바퀴: 콕콕 찌르기(자는 Z) → 알람시계를 울리며 흔들기(느낌표) → 서버가 눈 번쩍·하품·LED 켜짐·졸라맨 만세 → 다시 졸기
  - `frontend/src/components/NoteFx.tsx` — `FxBorder` 삭제, `FxTape`(두 번째 테이프)·`FxWrinkle`(구김살)·`FxHand`(밀어내는 손) 추가
  - `frontend/src/pages/EventsPage.tsx` — 삭제 때 카드 높이를 재서 `--h` 로 넘기고(빈자리 닫기), 1.8초 뒤 목록 다시 불러옴. 새 일정은 `FxTape`
  - `frontend/src/styles/motion.css` — 서버 깨우기 `.ws-*`, 새 일정(종이 툭 → 테이프 2장 철썩 → 펜 쓰기, 1.5초부터), 삭제(와락 구겨 공이 됨 → 손이 밀어 굴러감 → 아래 카드가 올라와 빈자리 닫힘, 1.7초), `.events-list { overflow-x: clip }`(밀려 나갈 때 가로 스크롤 방지). 전부 `prefers-reduced-motion: no-preference` 안(로딩 화면은 줄이기면 잠든 모습으로 정지)
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc/build 통과, lint 오류 없음. 브라우저에서 각 연출을 시간대별로 멈춰 확인(서버 깨우기 3.9초·5.6초, 삭제 0.5초·1.0초, 생성 0.9초·1.95초). 테스트로 만든 일정 3개는 삭제함. 실제 삭제 버튼·저장 흐름의 연속 재생은 못 봄(구성 요소를 DOM 에 넣어 확인).
- 남은 일 / 상대에게 요청: 로딩 화면에서 서버가 일찍 깨면 장면 중간에 끊김(정상). 삭제 연출은 구김 공 모양을 `clip-path: polygon` 으로 만들어 카드 폭이 아주 좁은 화면에서는 공이 작아 보일 수 있음. 커밋 안 함.
- 적용한 규칙 번호: A-2

### 2026-10-05 로그인 화면 졸라맨 그리기 + 터치하면 잘못 그려 지우고 다시 그리기, 약관 링크 정리, 소개 3컷 설명 문구 (작성: Claude Code)
- 수정 목적(사용자 요청): 로그인(`/start`) 화면도 소개 페이지처럼 졸라맨을 그리는 애니메이션으로. 그리는 중에 터치하면 펜을 건드려 선이 삐져나가고, 지우개로 지운 뒤 그 획을 다시 그림. 게스트 로그인 아래 문구는 `이용약관 • 개인정보 처리방침` 링크만. 소개 3컷 설명 문구 변경.
- 변경 파일:
  - `frontend/src/components/GreetingFigure.tsx` — `oops` prop 추가. 터치(pointerdown) 시 현재 긋는 획 끝에서 삐져나온 선(0.22s) → 펜 떨림(0.5s) → 지우개로 선과 그 획을 처음까지 지움(0.7s) → 그 획부터 다시 그림. 한 번 그리는 동안 최대 3번, 점·색칠 단계는 다음 획에서 반응. `oops` 가 없으면(소개 페이지) 기존처럼 터치하면 바로 완성
  - `frontend/src/pages/IntroPage.tsx` — `IntroFigure` 대신 `GreetingFigure oops`, 동의 문구("시작하면 동의한 것으로 봐요. 만 14세 이상…") 대신 약관·처리방침 링크만
  - `frontend/src/components/comic/HowToComic.tsx` — 3컷 설명 "일정을 등록하고 정보를 확인 할 수 있어요."
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc 통과, lint 기존 경고만. 소개 페이지에 잠깐 `oops` 를 붙여 삐져나온 선·지우개·다시 그리기가 도는 것은 확인(원복함). 실제 `/start` 화면은 로그인 상태라 못 봄.
- 남은 일 / 상대에게 요청: 만 14세 이상 안내 문구를 로그인 화면에서 뺐음 — 법적으로 필요하면 다시 넣을 것. `IntroFigure.tsx` 는 이제 로그인 화면에서 안 쓰임(`FigureBody` 다른 곳 사용 여부 확인 후 정리 가능).
- 적용한 규칙 번호: A-2

### 2026-10-05 일정 카드 쪽지 연출: 펜으로 쓰기 / 지우개로 지우고 다시 쓰기 / 구겨서 던지기 (작성: Claude Code)
- 수정 목적(사용자 아이디어): 새 일정은 일정 탭에서 펜으로 슥삭슥삭 나타나고, 고쳐서 저장하면 지우개로 지웠다가 다시 펜으로 쓰고, 지우면 구겨서 옆으로 던진다. "한번에 다 해보자"로 세 가지를 함께 구현. 일정 **목록 카드**를 테이프 붙인 쪽지 모양으로 바꿈(등록·편집 화면 자체를 노트로 바꾸는 것은 안 함).
- 변경 파일:
  - `frontend/src/lib/eventFx.ts`(신규) — 저장 화면이 일정 탭에 "어떤 카드를 어떻게 보여줄지"를 잠깐 적어 두는 보관함(`markEventFx`/`peekEventFx`/`clearEventFx`)
  - `frontend/src/components/NoteFx.tsx`(신규) — `FxBorder`(테두리를 그리는 펜 선), `PenTool`, `EraserTool`
  - `frontend/src/pages/NewEventPage.tsx` — 등록 저장 시 `created`, 수정 저장 시 `edited`(옛 제목·기간 포함)를 기록
  - `frontend/src/pages/EventsPage.tsx` — 해당 카드에 `fx-*` 클래스(4초 뒤 평소 카드로), 삭제는 구기는 연출 0.9초 뒤 목록 다시 불러오기
  - `frontend/src/styles/motion.css` — 쪽지 카드(테이프), 연출. 전부 `prefers-reduced-motion: no-preference` 안(움직임 줄이기면 연출 없이 바로 보임, 삭제도 바로)
- 보완(같은 날, 사용자 제보 "일정 보기로 돌아갔는데 슥삭 효과가 없다"): 새 일정이 **다른 달이거나 목록 아래쪽**이라 연출이 화면 밖에서 끝났을 가능성 → 일정 탭이 그 일정의 달로 넘어가고 카드가 보이게 스크롤한 **뒤에** 연출을 시작(`fxReady`), 그 전에는 카드를 숨김(`.fx-wait`). 연출 정리 타이머도 시작 시점부터 3.2초로 변경(예전엔 화면에 들어온 직후 4초라 느린 서버에서 먼저 끝날 수 있었음).
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc/build 통과, lint 기존 경고만. **실제 움직임은 못 봄**(로그인·일정 필요) — 일정을 등록·수정·삭제해 보며 타이밍(테두리 0.85s → 글씨 0.8~1.7s, 지우개 0.7s) 확인 필요.
- 남은 일 / 상대에게 요청: 글씨는 폰트라 획을 따라 쓸 수 없어 "왼쪽에서 오른쪽으로 드러나며 펜이 따라가는" 방식. 구겨짐은 찌그러짐·회전으로 흉내(진짜 접힘 아님). 목록 카드가 많은 저사양 폰에서는 연출 카드가 한 장이라 영향은 작을 것. 상세 화면에서 지우는 경우는 연출 없음. 커밋 안 함.
- 적용한 규칙 번호: A-1, A-2, A-3(연출은 약 1.7초로 길어짐: 필요하면 줄일 것), D-17

### 2026-10-05 일정 장소 필수(화면) + 소개 만화 3컷을 장소·날씨 흐름으로 수정 (작성: Claude Code)
- 수정 목적(사용자 결정): 장소를 안 적으면 다른 지역 날씨를 보게 되는 문제를 줄이려고 일정 등록·수정에서 장소를 필수로. 소개 페이지 "이렇게 사용해보세요" 3컷(면접 일정 → 단정하게)을 장소와 날씨 기준 흐름으로 바꿈.
- 변경 파일:
  - `frontend/src/pages/NewEventPage.tsx` — 저장 때 장소가 비면 "장소도 꼭 적어줘…" 안내, 라벨 "장소 (필수)"
  - `frontend/src/pages/EventDetailPage.tsx`, `mocks/events.ts` — 장소 위치를 못 찾았으면(`locationResolved === false`) 헤더에 "…의 위치를 찾지 못해서 내 기본 지역 날씨로 보여드려요" 안내
  - `frontend/src/components/comic/HowToComic.tsx` — 3컷: 달력에 장소 핀, "제주 여행 · 제주" → "뭐 입지…?" → 해 그림 + 하늘색 긴팔·베이지 바지 코디 "제주 날씨 맞춤!", 설명 "일정과 장소를 넣고 "뭐 입지?" 하면, 그곳 날씨에 맞게 골라줘요."
- 프론트 연결 사항: 없음(일정 응답의 `locationResolved` 는 기존 필드).
- 검증 결과: frontend tsc/build 통과. 만화 그림·화면 직접 확인은 못 함.
- 남은 일 / 상대에게 요청: **서버(`POST /api/events`)는 장소를 아직 필수로 하지 않음** — 캘린더에서 가져온 일정은 장소가 없을 수 있고, 통합 테스트 다수가 장소 없이 일정을 만들기 때문. 서버에서도 막으려면 테스트 수정 필요. 장소를 적었는데 위치를 못 찾는 경우의 대체(기본 지역)는 안내만 하고 막지는 않음. 커밋 안 함.
- 적용한 규칙 번호: D-9, D-17

### 2026-10-05 일정 "코디 필요" 체크박스: 옷차림이 필요 없는 일정은 그날 날씨만 보여줌 (작성: Claude Code)
- 수정 목적(사용자 결정): 일정 등록·수정에 "코디 필요" 낙서 체크박스. 여행·캠핑·등산·야외활동은 처음부터 체크(종류를 바꾸면 다시 체크). **기타는 체크박스 없이 항상 날씨만** 보여줌. 체크를 풀거나 기타면 일정 상세에서 옷차림 카드·코디 도우미·날짜별 코디를 모두 숨기고 그날 날씨만 표시.
- 변경 파일:
  - `backend/prisma/schema.prisma`, `prisma/migrations/20261005090000_event_needs_outfit/` — `Event.needsOutfit Boolean @default(true)` (기존 일정은 모두 true, 기타 종류는 코드에서 항상 날씨만)
  - `backend/src/services/recommendationService.ts` — `outfitWanted(e)`(= 기타 아님 && needsOutfit)
  - `backend/src/api/routes/events.ts` — 생성/수정 본문 `needsOutfit`(생략=true). `GET /:id/outfit` 은 옷차림이 필요 없으면 추천을 만들거나 저장하지 않고 `status: 'weather_only'` + `weather` 만 응답
  - `backend/src/services/serializers.ts` — 일정 응답에 `needsOutfit`(기타는 항상 false)
  - `backend/src/jobs/eventForecastJob.ts` — 기타·옷차림 불필요 일정은 예보 점검(추천 저장·푸시)에서 제외
  - `backend/tests/unit/outfitWanted.test.ts`(신규 3개)
  - `frontend/src/pages/NewEventPage.tsx`(체크박스 `DoodleCheck` "코디 필요", 종류 바꾸면 다시 체크), `EventDetailPage.tsx`(날씨만 보기), `EventsPage.tsx`(목록 문구 "날씨만 알려드려요"), `mocks/events.ts`(`needsOutfit`, `outfitKinds`), `types.ts`(`EventOutfit.status` 에 `weather_only`)
- 프론트 연결 사항: `POST/PATCH /api/events` 본문 `needsOutfit`(boolean, 선택), 일정 응답 `needsOutfit`, `GET /api/events/:id/outfit` 응답 `status: 'weather_only'` 추가(이때 `recommendation: null`, `days: []`).
- 검증 결과: backend typecheck/lint, 단위 테스트 497개 통과(마이그레이션은 로컬 DB 에만 적용). frontend tsc/build 통과. 통합 테스트·화면 직접 확인은 못 함.
- 남은 일 / 상대에게 요청: **배포(Render) 때 마이그레이션이 적용되는지 확인**(`migrate deploy`; 컬럼 기본값이 true 라 안전). 기타 일정에서도 코디 도우미 API(`/api/ai/event-stylist`)는 서버에서 막지 않음(화면에서만 숨김). 이미 푸시가 간 기타 일정의 알림 기준은 그대로. 커밋 안 함.
- 적용한 규칙 번호: D-9, D-17

### 2026-10-05 일정 ⋯ 메뉴(편집·삭제) 위치 어긋남 수정 (작성: Claude Code)
- 수정 목적: 일정 카드의 ⋯ 메뉴가 `position: fixed` 로 버튼 좌표에 띄우는데, 화면 등장 애니메이션(`.page-in`, `.rise`, 일정 카드 차례로)이 `animation-fill-mode: both` 라 끝난 뒤에도 transform 효과가 남아 조상이 fixed 의 기준(containing block)이 돼 메뉴가 엉뚱한 곳에 떴다.
- 변경 파일: `frontend/src/styles/motion.css` — 등장 애니메이션 5곳을 `both` → `backwards`(시작 전 상태만 적용, 끝나면 효과가 남지 않음)
- 프론트 연결 사항: 없음.
- 검증 결과: tsc 통과. 화면에서 메뉴 위치를 직접 확인하지는 못함(로그인 필요) — 새로고침 후 확인 필요.
- 남은 일 / 상대에게 요청: 앞으로 transform 을 쓰는 등장 애니메이션은 `both`/`forwards` 를 쓰지 말 것(fixed 자식 위치가 어긋남). 커밋 안 함.
- 적용한 규칙 번호: A-2

### 2026-10-05 일정 옷 추천 3단계: 정장 예시는 [예시로 보기]만, 바꾼 코디는 보온 재검증 + 부팅 화면 디자인 통일 (작성: Claude Code, 설계 검토: Codex)
- 수정 목적: 정장·원하는 옷 예시로 바꾼 코디가 날씨 보온을 채우는지 다시 세지 않아(5°C 후드티·바지·패딩 보온 11 → 정장 예시 6.5) 설명이 맞지 않던 문제. 예시는 기본 추천에 자동으로 섞지 않고, 내 옷이 날씨에 부족할 때만 눌러서 본다.
- 변경 파일:
  - `backend/src/rules/outfitCheck.ts`(신규) — `checkWarmth(items, wardrobe, required)`: 옷장 옷은 저장된 보온값, 예시 옷은 보통 두께 기본값으로 합을 세어 필요 보온과 비교
  - `backend/src/services/recommendationService.ts` — `dailyOutfits`: 정장 세트 예시는 `reuse.examples` 일 때만, 사용자가 말한 원하는 옷(wish)은 말한 대로 항상 반영. 바꾼 뒤에는 보온을 다시 세어 `notes`(엔진의 낡은 설명 대신 부족 안내)·`sub`·`warmthShort` 를 정함. `DayOutfit` 에 `canViewExamples`(= 엔진 `insufficientWardrobe`), `warmthShort`
  - `backend/src/api/routes/events.ts` — `GET /:id/outfit?examples=0|1`
  - `backend/src/services/stylistOutfit.ts` — 정장·원하는 옷을 대안 조합(`alternatives`)에도 똑같이 적용(다른 조합이 요청을 되돌리던 문제), 바꾼 뒤 보온이 모자라면 `warn`
  - `backend/tests/unit/outfitCheck.test.ts`(신규 4개) — 5°C 회귀(내 옷만이면 예시 없음·버튼 불필요, 예시로 보면 보온 부족 안내), `checkWarmth`
  - `frontend/src/pages/EventDetailPage.tsx`, `types.ts` — 날짜별 코디의 [예시로 보기]/[내 옷으로 돌아가기](내 옷이 날씨에 모자란 날이 있을 때만)
  - `frontend/index.html` — 서버 로딩 직전의 정적 부팅 화면(제목 위·졸라맨 아래, 같은 크기·기울기)을 앱의 스플래시 구성과 맞춤(예전엔 단순한 막대 졸라맨이 먼저 보였음)
- 프론트 연결 사항: `/api/events/:id/outfit` 쿼리 `examples`, 응답 `days[].canViewExamples`, `days[].warmthShort` 추가. `/api/ai/event-stylist` 의 `outfit.alternatives` 가 요청을 반영하고 `warn` 이 늘어남.
- 검증 결과: backend typecheck/lint, 단위 테스트 34파일 478개 통과. frontend tsc/build 통과. 통합 테스트·화면 직접 확인은 못 함.
- 남은 일 / 상대에게 요청: **하루 일정(`GET /outfit` 기본 추천)에서 정장 요청의 예시 분리는 아직**(하루는 코디 도우미 POST 가 정장 예시를 입힘, 보온 경고만 추가). 오늘 홈의 빈 옷장 일반 추천(`genericWardrobe`)은 그대로. 엔진 내부 재검증 단일 함수 통합, 중복 안내 정리(예시 반복 집계)는 후속. 정적 부팅 화면(`frontend/index.html`)은 `Splash` 를 렌더링한 HTML 을 그대로 넣은 사본이라 `Splash.tsx` 를 바꾸면 같이 고쳐야 함(개발 서버에선 CSS 가 늦게 붙어 첫 순간 스타일이 없을 수 있음, 배포 빌드는 CSS 가 먼저 로드됨 — 폰 확인 필요). 커밋 안 함.
- 적용한 규칙 번호: D-9

### 2026-10-05 일정 옷 추천 2단계: 연박 [상의][하의] 돌려입기 버튼 (작성: Claude Code, 설계 검토: Codex)
- 수정 목적: 연박 날짜별 코디는 기본적으로 앞선 날 옷을 피한다. 사용자가 버튼을 눌렀을 때만 그 자리(상의/하의)의 옷을 다시 입을 수 있게 한다. 겉옷은 항상 겹침 회피. "허용"이지 같은 옷을 강제로 고정하는 것은 아님(날씨 보온을 깨지 않으려고).
- 변경 파일:
  - `backend/src/services/recommendationService.ts` — `dailyOutfits(…, now, reuse)`, `DayReuse`. 돌려입기를 고른 자리는 `avoidIds` 에서 빼고 "부족해서 겹쳐요" 안내도 하지 않음. 자리는 엔진 결과의 한글 종류(`roleOf`)로 판단
  - `backend/src/api/routes/events.ts` — `GET /:id/outfit?reuseTop=0|1&reuseBottom=0|1`(생략=0, 그 외 값은 400), 응답에 `reuse:{top,bottom}` 추가
  - `backend/tests/unit/dailyVariety.test.ts` — 돌려입기 테스트 1개
  - `frontend/src/pages/EventDetailPage.tsx` — 날짜별 코디 위 "옷 돌려입기 [상의][하의]" 토글(상태가 바뀌면 다시 불러옴)
- 프론트 연결 사항: `/api/events/:id/outfit` 쿼리 `reuseTop`, `reuseBottom` 추가, 응답 `reuse` 추가(프론트는 아직 응답 `reuse` 를 읽지 않음). `docs/api.md` 갱신은 안 함.
- 검증 결과: backend typecheck/lint, dailyVariety·dailyWish 단위 테스트 14개 통과, frontend tsc 통과. 통합 테스트와 화면 직접 확인은 못 함.
- 남은 일 / 상대에게 요청: 3단계(예시 분리·보온 재검증). Codex 설계안: 예시 클릭 때만 가상 옷을 엔진 후보에 넣고, 최종 평가를 `outfitEngine` 의 단일 함수로 모으며, 이벤트 기본 경로에서는 `genericWardrobe` 자동 대체를 끄고 `canViewExamples`는 `insufficientWardrobe` 가 아니라 최종 보온 부족·필수 종류 없음으로 판정. 5°C 후드티+바지+패딩이 정장 선택 뒤 보온 11→6.5 로 떨어지는 사례를 회귀 테스트로 사용. 커밋 안 함.
- 적용한 규칙 번호: D-9

### 2026-10-05 일정 상세 옷 추천 개선 1단계: 오류와 '예보 없음' 분리, 추천 카드 항상 표시, 날짜별 안내 전체 표시 (작성: Claude Code)
- 수정 목적: Codex 검토(2·5·6번)에서 나온 것 중 작은 것. 방향(사용자 결정): 연박 [상의][하의] 돌려입기 버튼(눌렀을 때만 재사용, 2단계), 예시는 옷이 부족할 때만 [예시로 보기](3단계). 푸시는 끄지 않고 그대로 둠.
- 변경 파일:
  - `frontend/src/pages/EventDetailPage.tsx` — 요청 실패(`failed`)를 "예보 없음"과 구분해 "불러오지 못했어요 + 다시 시도" 표시. 하루 일정은 코디 도우미가 아직 카드를 안 펼쳤을 때도 기본 추천 옷 목록을 보여줌(`showPlainOutfit`). 날짜별 코디의 안내(`notes`)를 첫 줄만이 아니라 전부 표시
  - `frontend/src/components/EventStylist.tsx` — `onBase` 콜백(도우미가 코디 카드를 직접 보여주는지 알림)
- 프론트 연결 사항: 없음(백엔드 변경 없음).
- 검증 결과: frontend tsc/build 통과, lint 기존 경고만. 화면 직접 확인은 못 함(로그인·일정 데이터 필요).
- 남은 일 / 상대에게 요청: 2단계 돌려입기 토글, 3단계 예시 분리·보온 재검증(백엔드 `stylistOutfit.ts`, `outfitWish.ts`, `recommendationService.ts`). 커밋 안 함.
- 적용한 규칙 번호: D-9

### 2026-10-05 일정 말로 적기: 말이 끝난 뒤·'채워줘' 눌렀을 때만 채움 (작성: Claude Code)
- 수정 목적: 음성 인식 중(말이 안 끝났는데)과 직접 타이핑 중에도 250ms 뒤 칸이 바로 채워지던 것을 없앰. 음성은 말이 끝난 글로 한 번, 글자는 '채워줘'(또는 Enter)를 눌렀을 때만 해석.
- 변경 파일: `frontend/src/pages/NewEventPage.tsx` — 입력 중 자동 해석 `useEffect([say])` 제거(음성 종료 시 실행은 `SayBox` 의 `submitOnVoice` 가 이미 담당).
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc 통과, lint 기존 경고만. 실제 마이크·브라우저 동작은 못 함(폰 확인 필요).
- 남은 일 / 상대에게 요청: Enter 키도 '채워줘'와 같은 동작으로 둠. 일정 상세 옷 추천 품질 검토는 Codex 보고 대기.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 일정 그림(졸라맨 장면)이 움직임 (작성: Claude Code)
- 수정 목적: 일정 종류·기타 일정 그림이 정지 그림이었음. 그림 모양·색·배경은 그대로 두고 안의 기존 부분만 움직이게 함(러닝의 바람 줄처럼).
- 변경 파일:
  - `frontend/src/components/StickPerson.tsx` — 장면 목록 `SCENES`(루트 svg 에 `sp-idle`: 숨 쉬듯 1.5px), 각 장면의 기존 부분에 `sp-*` 클래스(그림은 `<g>` 로 묶기만 함, 새 도형·색 없음). 여행·기본 가방/캐리어 달랑, 생일 촛불 깜빡·만세 팔, 데이트 꽃 살랑·하트 두근, 식사 김·젓가락, 건배 잔 짠, 선물 통통, 공연 응원봉 흔들·음표 둥실, 운동 공 통통, 일 가방 달랑, 기다림 말풍선·손 흔들기, 캠핑 모닥불 일렁, 등산 깃발 펄럭(깃대와 깃발 경로를 둘로 나눔, 모양 동일), 야외활동 해 천천히 회전·나뭇잎 살랑
  - `frontend/src/styles/motion.css` — `.sp-*` 움직임(전부 "움직임 줄이기" 아닐 때만). 주의: CSS transform 을 쓰는 요소에 `transform` 속성이 있으면 덮어쓰이므로 transform 속성이 있는 그룹에는 클래스를 붙이지 않고 안쪽 요소에 붙임
  - `frontend/src/pages/WeatherPreviewPage.tsx` — `/weather` 에 "일정 종류 그림"(여행·캠핑·등산·야외활동·기다림) 추가
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc/build 통과. `/weather` 에서 그림 모양 변화 없음 확인, 움직임 14종 동작 확인(건배는 쉬는 구간이 길어 순간 값이 같을 수 있음).
- 남은 일 / 상대에게 요청: 일정 목록에 카드가 많으면 SVG 필터 + 움직임으로 저사양 폰이 느릴 수 있음 → 폰에서 확인. 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 기타 일정 그림: 러닝(달리는 졸라맨) 추가 (작성: Claude Code)
- 수정 목적: 기타 일정 제목에 러닝·달리기 등이 있을 때 공 차는 "운동" 그림이 아니라 달리는 그림을 보여줌.
- 변경 파일:
  - `frontend/src/components/StickPerson.tsx` — `Mood` 에 `run`: 앞으로 7° 기운 몸, 성큼성큼 달리는 다리, 접어 흔드는 팔, 파란 머리띠, 땀방울, 뒤로 흩날리는 바람 줄(움직임 줄이기 아닐 때만 흩날림)·땅 먼지
  - `frontend/src/lib/eventMood.ts` — 키워드 `러닝/런닝/달리기/조깅/마라톤/러너/러닝크루/트레일런/10km/5km/10k` → `run`(운동 `sport` 보다 먼저), `isSceneMood` 에 `run`
  - `frontend/src/pages/WeatherPreviewPage.tsx`(`/weather` 에 "한강 러닝" 예시), `styles/motion.css`(`.run-lines`)
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc/build 통과. `/weather` 에서 그림 확인, 키워드 10개 매핑 확인(풋살·헬스·농구는 기존 `sport` 유지).
- 남은 일 / 상대에게 요청: 없음.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 일몰 후 날씨 그림: 맑음·구름 조금은 해→달 (작성: Claude Code)
- 수정 목적: 밤 그림이 "맑음 + 20시~새벽 5시"에만 적용돼, 구름 조금은 밤에도 해가 구름 뒤에 있는 그림이었고 일몰 시각도 계절을 반영하지 못했음.
- 규칙(사용자 결정): 실제 일몰~일출 사이면 **맑음 → 달(night), 구름 조금 → 구름 뒤 달(partlynight, 신규)**. 비·눈·진눈깨비·소나기·바람·미세먼지·폭염·한파·서리 등 따로 표시해야 하는 날씨와 흐림은 밤에도 그대로.
- 변경 파일:
  - `backend/src/services/weather/sun.ts`(신규) — 날짜·위경도로 태양 고도를 구해 일몰~일출 판정(`isNightAt`, 기준 -0.833°). 서울 하지·동지 일출·일몰이 실제와 1분 차이
  - `backend/src/utils/grid.ts` — `gridToLatLng`(기상청 격자 → 위경도, 역변환)
  - `backend/src/services/weather/conditions.ts` — `night` 입력(없으면 예전 20시~5시 규칙), `partlynight` 종류, `hourlyKind()`(시간별 줄 공통 규칙)
  - `backend/src/api/routes/weather.ts` — 지역 격자 중심 좌표로 현재·시간별 모두 일몰 계산
  - `frontend/src/components/DoodleWeather.tsx`(구름 뒤 달 그림 `partlynight`), `WeatherAmbience.tsx`(밤 배경: 별 + 구름)
  - 테스트 `backend/tests/unit/sun.test.ts`(15개)
- 프론트 연결 사항: `/api/weather/today` 의 `condition` 과 `hourly[].condition` 에 `partlynight` 가 올 수 있음(`WeatherKind` 에 추가됨). 일정 날씨 아이콘(`daily`)은 낮 기준이라 변경 없음.
- 검증 결과: backend typecheck/lint/전체 테스트 615 통과, 3 실패는 기존(미세먼지 1, 다른 세션 칭호 변경 후 낡은 캐릭터 테스트 2). frontend tsc/build 통과, `/weather` 에서 새 그림 확인.
- 남은 일 / 상대에게 요청: 지역 좌표는 5km 격자 중심이라 일몰이 실제와 1~2분 어긋날 수 있음. 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 움직이는 날씨 그림·홈 배경 효과·화면 등장·옷장/캐릭터/일정/탭 움직임 (작성: Claude Code)
- 수정 목적: 앱에 낙서 디자인에 어울리는 살아 있는 느낌을 더함. 홈 날씨가 해(햇살이 돌고 숨 쉬듯)·구름(흘러감)·비(추적추적 + 물웅덩이 파문)·번개(번쩍)·눈(내려앉음)·바람·안개·먼지·밤(별 반짝) 등으로 움직임.
- 변경 파일:
  - `frontend/src/components/DoodleWeather.tsx` — `WeatherDoodle`/`Sun`/`Cloud` 에 `animate` 옵션. 그림 모양은 그대로, 움직이는 부분에만 `wx-*` 클래스(animate 일 때 svg 에 `wx` 클래스가 붙어야 움직임)
  - `frontend/src/components/WeatherAmbience.tsx` — 날씨 카드 뒤 배경 효과(햇살 빛+도는 햇살선, 흐르는 구름, 빗줄기+파문, 번개 번쩍임, 눈, 안개 줄, 바람 줄, 먼지, 별). 날씨 종류 → 효과 매핑 `LAYERS`, 무작위 대신 계산으로 흩뿌려 렌더마다 같은 모양
  - `frontend/src/styles/motion.css`(신규, `main.tsx` 에서 불러옴) — 모든 움직임. 전부 `@media (prefers-reduced-motion: no-preference)` 안에 있어 "움직임 줄이기" 설정이면 멈춤. 홈 카드 차례로 올라옴(`.rise`), 화면 전환 시 나타남(`.page-in`, `App.tsx` 에서 첫 경로 조각이 바뀔 때만), 옷장 빨랫줄 옷 살랑살랑(`line-sway`), 캐릭터 둥실·잠금 자물쇠 달랑, 일정 오늘 날짜 콩닥·카드 차례로, 설정 묶음 차례로, 하단 탭 고른 아이콘 통통, 버튼 누르면 꾹
  - `frontend/src/pages/HomePage.tsx`, `WeatherPreviewPage.tsx`(개발용 `/weather` 에서 모든 날씨를 움직이는 상태로 확인)
- 프론트 연결 사항: 없음.
- 검증 결과: frontend tsc/lint(기존 경고만)/build 통과. `/weather` 와 홈(구름 조금)에서 직접 확인, 옷장 34벌 sway 동작·각 화면 animation 개수 확인. 비·눈 등의 실제 움직임 느낌과 저사양 폰 성능은 폰에서 확인 필요.
- 남은 일 / 상대에게 요청: 옷장은 옷이 많으면 `will-change` 레이어가 늘어남 → 폰에서 버벅이면 sway 를 화면에 보이는 줄만 또는 끄기. 밤 날씨는 'night' 일 때만 별이 나옴(현재 날씨 데이터에 night 가 오는지 확인 필요). 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 개인정보 안내 정리 + 로그인 없이 열리는 공개 페이지 + 후기 본문 디스코드 제외 (작성: Claude Code)
- 수정 목적: 점검 보고서 P0(S5): 국외 이전·연령 기준·탈퇴 후 남는 정보·디스코드 전송이 안내와 실제 처리가 어긋났던 것을 정리하고, 스토어 제출·계정 삭제 안내용 공개 URL 을 만듦.
- 사용자 답을 못 받아 기본값으로 정함(바꾸려면 알려 주세요): 연령 기준 **만 14세 이상**(`MIN_AGE`), 후기·의견 **본문은 디스코드로 안 보냄**(관리자 화면에서만 확인, `DISCORD_INCLUDE_MESSAGE=true` 로 켤 수 있으나 켜면 방침 5번 문구도 고쳐야 함).
- 변경 파일:
  - `frontend/src/pages/legalText.ts` — 이용약관 9개 항목(연령, AI 기능의 성격, 책임 한계, 베타 안내 등), 개인정보처리방침 10개 항목(국외 이전: Google Gemini·Vercel·Render·Neon·알림 전달, 서버 로그의 IP, 탈퇴 후 남는 것(AI 기록 익명화, 호스팅 백업·로그), 30일 빈 게스트 자동 삭제, 쿠키 기간, 만 14세 미만, 이용자 권리, 안전 조치, 시행일 `LEGAL_EFFECTIVE`), 계정 삭제 안내 5개 항목. FAQ 의 낡은 알림·탈퇴 답변도 현재 동작에 맞춤
  - `frontend/src/pages/LegalPage.tsx`, `components/Legal.tsx`, `App.tsx` — 공개 페이지 `/terms`, `/privacy`, `/delete-account`(로그인 불필요, 하단 탭 없음, 문서 제목 설정). 설정 화면도 같은 `Legal` 컴포넌트 사용
  - `frontend/src/pages/LandingPage.tsx`(하단 링크), `IntroPage.tsx`("시작하면 약관·방침에 동의, 만 14세 이상" 안내)
  - `backend/src/config/env.ts`, `services/review/notifyOwner.ts` — `DISCORD_INCLUDE_MESSAGE`(기본 false). 꺼져 있으면 별점·종류·사용자 번호만 보냄. `tests/unit/notifyOwner.test.ts`
- 프론트 연결 사항: 없음(백엔드 API 변경 없음).
- 검증 결과: backend typecheck/lint/신규 테스트 통과, frontend tsc/build 통과, `/privacy` 화면 확인.
- 남은 일 / 상대에게 요청: ⚠️ 법적 검토는 하지 않았음(일반 초안). 사실 확인 필요: 호스팅 지역(Vercel/Render/Neon 서버 위치), Gemini 무료 등급 여부(입력이 학습에 쓰일 수 있음 → 유료 전환 또는 방침 문구 보강), 호스팅 백업·로그 보관 기간. Play 개인정보 양식에도 같은 내용을 써야 함. 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 베타 전 안정성·보안 묶음 1 (로그인 유지, 첫 로딩, 로그 마스킹, 게스트·관리자 세션, 캐릭터 캐시) (작성: Claude Code)
- 수정 목적: 점검 보고서 P0/P1 중 작은 항목을 한 번에. (S1) 로그인이 30일 뒤 무조건 풀려 게스트가 옷장을 잃음, (S3) 서버가 잠들었다 깨는 동안 빈 화면·무한 대기, 요청 로그에 좌표·카카오 code 노출, 게스트 연타 중복 생성·정리 없음, 관리자 로그인 때 세션 재생성 없음, 로그아웃 후 이전 계정 캐릭터가 잠깐 보임.
- 변경 파일:
  - `backend/src/api/middleware/sessionRenew.ts`(+`app.ts`, `common.ts` 세션 타입) — 로그인한 사용자는 12시간마다 쿠키 기간을 30일로 연장(마지막으로 쓴 날부터 30일). express-session `rolling` 은 요청마다 DB 를 쓰므로 쓰지 않음
  - `backend/src/utils/maskUrl.ts`(+`app.ts` pino-http serializers) — 요청 로그 url·query 값을 `***` 로
  - `backend/src/api/routes/admin.ts` — 관리자 비밀번호 로그인 시 `session.regenerate`(원래 로그인한 userId 는 이어 줌)
  - `backend/src/jobs/guestCleanupJob.ts`(+`worker.ts` 매일 04:40 KST) — 30일 넘게 안 온 "빈" 게스트(직접 담은 옷·일정·후기·캘린더·알림 구독·앱 후기·의견 없음, 카카오 연결·관리자 아님)만 삭제
  - `backend/src/services/admin/opsChecks.ts`, `admin.ts` — `/ops/health` 에 `network`(서버가 본 IP vs X-Forwarded-For) 추가: 프록시 뒤 IP 제한 공유 여부 진단(S2). 관리자 화면 표시는 아직 안 붙임
  - `frontend/src/api.ts` — 타임아웃(일반 25초, AI 60초)과 재시도(조회 2회, 502/503/504 포함. 저장·삭제는 재시도 없음), `ApiOptions`
  - `frontend/src/auth.tsx` — 처음 로그인 확인 `/api/me` 는 30초 × 3회 재시도, 로그아웃·탈퇴 때 `resetCharacterCache()`
  - `frontend/src/components/Splash.tsx`, `App.tsx`, `index.html`, `global.css` — 로딩 스플래시(3.5초 뒤 "서버가 잠에서 깨어나는 중" 안내), 정적 부팅 화면, 하단 탭은 로그인 확인 뒤에만
  - `frontend/src/pages/IntroPage.tsx` — 게스트 시작 중 버튼 잠금
  - 테스트: `backend/tests/unit/hardening.test.ts`, `tests/integration/hardening.test.ts`(16개)
- 프론트 연결 사항: `/ops/health` 응답에 `network` 필드 추가(기존 필드는 그대로).
- 검증 결과: backend typecheck/lint 통과, 전체 테스트 598 통과 / 3 실패(기존: 미세먼지 1, 다른 세션이 새 칭호 5종을 넣으며 낡은 캐릭터 통합 테스트 2). frontend tsc/build 통과. 서버를 꺼 두거나 9초 늦게 응답하게 해서 스플래시·안내·"다시 시도" 화면을 직접 확인.
- 남은 일 / 상대에게 요청: 운영(Vercel→Render)에서 `network.ok` 확인(IP 제한 공유 여부) 후 필요하면 `trust proxy` 단계 조정. 서버 상시 깨우기(외부 크론)는 사용자 작업. 관리자 시스템 탭에 network 표시 추가 가능. 커밋 안 함.
- 적용한 규칙 번호: B-8

### 2026-10-05 관리자 페이지 PC 넓은 화면 + 시스템 점검·사용자·인사이트 추가, 알림 진동·긴급 전달 (작성: Claude Code)
- 수정 목적: 관리자 화면이 PC 에서도 폰 폭(460px)으로만 보이던 것을 넓은 대시보드로 바꾸고, 베타 운영에 필요한 확인 기능을 추가. (별도) 푸시 알림에 진동·긴급 우선순위를 요청.
- 변경 파일:
  - `backend/src/api/routes/admin.ts` — `GET /ops/health`(설정 점검·예약 작업·알림 발송 현황·서버 정보), `GET /users`(고객번호·활동 수치, 닉네임·이메일 없음), `GET /insights`(재방문 D1/D7 근사, 하루 추천 조회 사용자, 접속일수, 옷·칭호 분포, 체감 후기, 일정 종류)
  - `backend/src/services/admin/opsChecks.ts`, `insights.ts` — 순수 함수(점검 항목에 키·비밀번호 값은 넣지 않음, VAPID_SUBJECT 형식 검사 포함)
  - `backend/tests/unit/adminOps.test.ts`, `tests/integration/admin-dashboard.test.ts` — 신규(21개)
  - `frontend/src/pages/AdminPage.tsx` — 탭(개요·사용자·인사이트·시스템·AI·후기·의견), 먼저 도착한 것부터 표시, 1분 자동 새로고침 선택
  - `frontend/src/pages/admin/*`, `frontend/src/styles/admin.css` — 탭별 화면과 PC/폰 레이아웃
  - `frontend/public/sw.js` — 알림에 진동·badge·tag(renotify), `backend/src/services/push/push.ts` — `urgency: 'high'`
- 프론트 연결 사항: 새 관리자 API 3개(위). 기존 관리자 API 는 그대로.
- 검증 결과: backend typecheck/lint/신규 테스트 통과, frontend tsc/build 통과. 로컬(사용자 512명 테스트 데이터)에서 PC 1440px·폰 375px 로 6개 탭을 직접 확인. 헤드업(위에서 내려오는 띠) 여부는 안드로이드 알림 채널 중요도가 정하므로 앱에서 강제할 수 없음 — 폰의 알림 설정 안내 필요.
- 남은 일 / 상대에게 요청: 재방문율은 접속 기록이 마지막 접속 시각 하나뿐이라 근사값(정확하게 하려면 접속 기록 테이블 필요). 사용자 목록은 최근 가입 500명까지. 커밋 안 함.
- 적용한 규칙 번호: S-6

### 2026-10-05 칭호: 새 칭호 5종 + 칭호별 복장·소품 + 도감에 취향 칭호 (작성: Claude Code)
- 수정 목적: 지난 기록의 남은 일 처리. 새 칭호(계절·상하의 쏠림), 취향 칭호도 도감에 안내, 칭호에 맞는 옷 스타일로 캐릭터가 입도록(캐릭터 그림은 그대로).
- 변경 파일:
  - `backend/src/services/character/analysis.ts` — 칭호 15→20종: SUMMER_COOL(얇은 옷 50%), WINTER_THICK(두꺼운 옷 40%), SPRING_FALL(보통 두께 긴팔·셔츠·맨투맨·가디건·자켓·바람막이 60%), TOP_HEAVY(상의 70%·7벌), BOTTOM_HEAVY(하의 45%·4벌). 상·하의 쏠림은 구조 칭호(특징 칭호 뒤). 취향 칭호에 `kind/value/category` 추가(복장용)
  - `backend/tests/unit/characterAnalysis.test.ts`, `tests/unit/adminOps.test.ts` — 20종·경계값·취향 힌트 테스트
  - `frontend/src/lib/character.ts` — 새 5종 `PERSONA_WEAR`, `tasteWear()`/`wearOf()`(취향 칭호는 두드러진 색·종류·무늬를 그대로 입음)
  - `frontend/src/components/CharacterDecor.tsx`, `ThemeScribble.tsx` — 새 5종 소품(아이스바·낙엽/꽃잎·눈·옷더미·걸린 바지)과 테마색
  - `frontend/src/pages/CharacterPage.tsx`, `styles/global.css` — 도감에 취향 칭호 3가지 설명 섹션(내 취향 칭호 표시), 복장은 `wearOf`
  - `PROJECT_RULES.md` — 15종→20종
- 프론트 연결 사항: TitleKey 20종(백엔드 `TitleKey` ↔ 프론트 `PERSONA_WEAR`·소품·테마). `analysis.taste` 에 `kind('color'|'type'|'pattern')`, `value`(화면 문자열), `category`('TOP'|'BOTTOM'|'OUTER', 종류일 때) 추가.
- 검증 결과: backend typecheck/lint, 단위 테스트 444 통과. frontend tsc/build 통과(lint 오류 없음). 로그인이 필요한 캐릭터 화면은 브라우저로 직접 못 봄.
- 남은 일 / 상대에게 요청: 새 칭호 복장·소품 모양은 실제 화면에서 한번 확인 필요. 아직 커밋 안 된 다른 작업(admin, push, sw.js)은 이번 커밋에서 제외.
- 적용한 규칙 번호: C-8, R-13

### 2026-10-05 칭호: 취향 칭호 추가 + 희귀 칭호 조건 약하게 완화 (작성: Claude Code)
- 수정 목적: 옷이 10벌 이상이어도 칭호가 거의 안 나오던 문제(시뮬레이션: 10벌 93%, 20벌 99% 칭호 없음). 모든 사용자가 열리면 칭호를 갖도록 함.
- 결정(사용자 합의): B(취향 칭호 자동 부여) + A(조건 약하게 완화). 희귀 칭호 15개는 그대로 두고 비율 기준만 5~15%p 낮춤.
- 변경 파일:
  - `backend/src/services/character/analysis.ts` — 비율 완화(후드티·셔츠·치마·겉옷·따뜻한 곰 40%, 반팔·검정·무늬·한 색·갈색계·파랑계·비타민 50%, 미니멀리스트 65%, 파스텔 50%/30%), `tasteOf()` 와 `Analysis.taste` 추가(희귀 칭호가 없고 열렸을 때만. 색 "○○ 편애 중" / 종류 "○○ 단골" / 무늬 "○○ 포인트", 같은 특징 2벌 미만이면 null)
  - `backend/tests/unit/characterAnalysis.test.ts` — 경계값을 새 기준으로, 취향 칭호 테스트 7개 추가
  - `frontend/src/lib/character.ts`, `pages/CharacterPage.tsx` — `a.title ?? a.taste` 로 표시, 취향 칭호면 "왜 이 칭호예요?" 에 설명, 가장 가까운 희귀 칭호 힌트
  - `frontend/src/pages/legalText.ts` — FAQ 문구
- 프론트 연결 사항: `/api/character` 의 `analysis.taste` 추가(`{key:'TASTE', name, tagline, rule, reason} | null`). `title` 은 이전처럼 희귀 칭호만 담음(없으면 null).
- 검증 결과: backend typecheck/lint/전체 테스트 565 통과, 기존 실패 1(미세먼지). frontend tsc/build 통과. 가상 옷장 3,000개 시뮬레이션: 10벌 희귀 25.8%·취향 74.2%·탐색중 0%, 20벌 희귀 4.4%·취향 95.6%. 로컬 화면에서 "반팔 단골" 표시 확인.
- 남은 일 / 상대에게 요청: 취향 칭호는 도감에 없음(사용자 결정 2번 보류 → 현재는 도감 15개 그대로). 새 칭호(계절·상하의 쏠림 등)는 아직 안 만듦. 옷이 많을수록 희귀 칭호 비율이 낮아지는 구조(비율 기준)는 그대로.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 폰 화면 줄바꿈 정리 + 위쪽 고정을 옷장·일정으로 한정 (작성: Claude Code)
- 수정 목적: 폰(360·320px)에서 한글이 낱말 중간에서 끊기고, 마지막 줄에 1~2글자만 남던 곳 정리. 홈 외출 카드와 설정의 외출·귀가 표시 개선. 위쪽 제목·버튼 줄 고정은 옷장·일정만 하고 홈·캐릭터·설정은 해제.
- 원인: 앱 전체에 `word-break: keep-all` 이 없어 한글이 글자 단위로 끊김(전수 측정 65곳, 12개 화면).
- 변경 파일:
  - `frontend/src/styles/global.css` — body `word-break: keep-all; overflow-wrap: anywhere`, 제목류 `text-wrap: balance`, 문단 `text-wrap: pretty`, `.nb`(끊지 않는 덩어리), 후기 별점 라벨, 캐릭터 % 막대, 설정 이름 한 줄, 고정은 `.sticky-head > .page-head` 로 한정
  - `frontend/src/components/CommuteLine.tsx` — 홈 외출 카드: 첫 줄 "외출 N° → 귀가 N°", 그 아래 줄마다 한마디(`commuteSummary` 반환이 문자열에서 {temps, notes, prefix} 로 바뀜, 호출처는 이 파일뿐)
  - `frontend/src/pages/SettingsPage.tsx` — 개인맞춤 값을 "보통 / 외출 / 귀가" 한 줄씩(`Row` value 가 ReactNode 허용)
  - `frontend/src/components/RuleText.tsx` — 신규. 칭호 조건을 조건마다 한 줄, "N% 이상·N벌 이상"은 끊지 않음. `CharacterPage.tsx` 3곳에서 사용
  - `frontend/src/pages/LandingPage.tsx`, `AddClothingPage.tsx` — 문구/끊김 정리
  - `frontend/src/pages/WardrobePage.tsx`, `EventsPage.tsx` — `main` 에 `sticky-head`
- 프론트 연결 사항: 없음
- 검증 결과: frontend tsc/lint/build 통과. 360px 측정 낱말 끊김 65→7곳(남은 건 `·`·`(` 앞의 자연스러운 끊김), 320px 2건(홈 옷 이름 "검정/반팔"). 옷장·일정만 스크롤 시 제목줄 고정, 설정·캐릭터는 고정 안 됨 확인. 실제 폰·시스템 글자 크기 확대는 못 봄.
- 남은 일 / 상대에게 요청: 캐릭터 잠금 화면·위치/알림 첫 화면·오류 상태의 줄바꿈은 아직 안 봄. 개발 서버가 편집 중간 버전을 캐시해 "Fragment is not defined" 가 뜰 수 있으니 이상하면 서버 재시작.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 옷장·일정 위쪽 제목·버튼 줄 고정 (작성: Claude Code)
- 수정 목적: 스크롤하면 [옷 추가]·[옷 삭제]·[일정 추가] 같은 위쪽 버튼 줄이 사라지던 문제.
- 원인: 폰에서는 상태바 여백(safe-area) 때문에 페이지가 조금 길어져 화면 전체가 스크롤되고 제목 줄이 밀려남. 또 `.app` 의 `overflow-x: hidden` 이 스크롤 영역을 만들어 sticky 가 동작하지 않음.
- 변경 파일:
  - `frontend/src/styles/global.css` — `.page-head` sticky(top 0, 종이색 배경, 안전 영역 보정), `.events-list .month-title` sticky, `.app` 은 `overflow-x: clip`(미지원 브라우저는 hidden)
- 프론트 연결 사항: 없음. `.page-head` 를 쓰는 모든 화면(설정, 옷 추가 등)도 같이 고정됨.
- 검증 결과: frontend tsc/build 통과. 로컬 모바일 크기에서 화면을 스크롤해 옷장·일정 제목 줄이 맨 위에 남는 것 확인. 실제 폰(상태바 여백)은 못 봄.
- 남은 일 / 상대에게 요청: 커밋 안 함. iOS Safari 15 이하는 clip 미지원이라 고정이 안 될 수 있음.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 20벌 등록 후 빨랫줄 애니메이션 렉·빈 화면 + 로딩 집게 위치 (작성: Claude Code)
- 수정 목적: 한꺼번에 20벌쯤 등록하면 옷장의 빨랫줄 줄이 렉 걸리고, 보이는 자리(줄 끝)가 비어 있어 좌우로 넘겨야 옷이 나타나던 문제. 사진 인식/저장 로딩의 빨래집게가 옷 위가 아니라 옆에 떠 있던 문제.
- 원인: 새 옷마다 0.35초 간격으로 차례로 걸려서 20벌이면 마지막(보이는 쪽) 옷이 약 7초 뒤에 나타남 + 두 화면 넘게 부드럽게 넘기느라 렉. 로딩 줄에는 집게를 옷 위에 고정하는 스타일이 없었음.
- 변경 파일:
  - `frontend/src/pages/WardrobePage.tsx` — 줄마다 줄 끝쪽 마지막 6벌(MAX_HANG_ANIM)만 걸리는 애니메이션, 나머지는 처음부터 걸려 있음
  - `frontend/src/components/LineScroller.tsx` — 두 화면 넘게 넘길 때는 부드럽게 굴리지 않고 바로 이동
  - `frontend/src/styles/global.css` — 로딩 줄(.hl-item) 집게를 옷 위에 고정
- 프론트 연결 사항: 없음
- 검증 결과: frontend tsc/lint/build 통과. 로컬에서 20벌 저장 후 옷장: 애니메이션 대상 6벌, 줄 끝이 바로 보임. 로딩 화면 집게 위치 스크린샷으로 확인. 폰 실제 렉(저사양)은 못 봄.
- 남은 일 / 상대에게 요청: 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 사진 여러 벌 등록: 같은 옷 합치기 + 이미 등록된 옷 초록 체크 (작성: Claude Code)
- 수정 목적: 행거·옷장 사진에서 똑같은 옷(종류·색·무늬 같음)이 여러 벌 담기는 문제. 같은 옷은 한 벌로 합치고, 내 옷장에 이미 있으면 "이미 등록되어 있어요"(초록 체크)로 표시하고 등록 대상에서 뺀다.
- 변경 파일:
  - `frontend/src/pages/ScanClosetPage.tsx` — 내 옷장(GET /api/clothes, 예시 옷 제외)과 비교, 분석 결과를 종류|색|무늬 키로 합침, 저장 대상에서 이미 있는 옷·고치다 같아진 옷 제외
  - `frontend/src/styles/global.css` — 초록 체크 표시
- 프론트 연결 사항: 없음(서버 변경 없음, 규칙은 화면에서만 적용)
- 검증 결과: frontend tsc/lint/build 통과. 사진 인식 응답을 흉내 내(같은 청바지 3벌·이미 있는 옷 2벌) 화면에서 6벌→3벌 합침, 초록 체크 2벌, 등록 대상 1벌 확인. 실제 AI 사진은 못 돌려 봄.
- 남은 일 / 상대에게 요청: "한 벌씩 추가"(말로 적기)와 서버(bulk/단건)에는 같은 옷 제한을 아직 적용하지 않음. 커밋 안 함.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 여러 벌 저장·사진 인식 대기 개선 + 칭호 없을 때 안내 (작성: Claude Code)
- 수정 목적: 사진 스캔/여러 벌 저장 때 한 벌씩 기다리던 것을 줄이고, 기다리는 동안 빨랫줄 로딩을 보여줌. 칭호 조건에 안 맞는 옷장에 "가장 가까운 칭호" 안내와 임시 칭호 "취향 탐색 중".
- 변경 파일:
  - `backend/src/api/routes/clothes.ts` — `POST /api/clothes/bulk` 추가(최대 40벌, 한 트랜잭션: 전부 저장되거나 하나도 안 됨)
  - `backend/tests/integration/clothes-bulk.test.ts` — 신규
  - `frontend/src/components/HangLoader.tsx` + `global.css` — 빨랫줄에 옷이 걸리고 흔들리는 로딩
  - `frontend/src/pages/AddClothingPage.tsx`, `ScanClosetPage.tsx` — 저장은 bulk 한 번, 사진 구간은 동시 요청(결과는 순서대로 합침), 로딩 표시
  - `frontend/src/pages/CharacterPage.tsx` — 칭호 없을 때 임시 칭호(프론트 전용, 서버 title 은 null 그대로) + a.next(가장 가까운 칭호) 안내
- 프론트 연결 사항: 새 API `POST /api/clothes/bulk {items:[{type,color,pattern?}]}` → 201 Clothing[]
- 검증 결과: backend typecheck/lint/clothes-bulk 테스트 4개 통과, frontend tsc/build 통과. 로컬 브라우저에서 저장 지연을 걸어 로딩 화면과 저장 후 옷장 이동 확인. 사진 인식 병렬 동작은 AI 호출이 필요해 실제로 못 돌려 봄.
- 남은 일 / 상대에게 요청: 커밋 안 함. 임시 칭호는 도감에 없고 공유 카드 제목에만 쓰임.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 옷 등록 진입을 아래 시트로, 사진 스캔 저장 후 빨랫줄 애니메이션 (작성: Claude Code)
- 수정 목적: "옷 등록하러 가기"를 누르면 아래에서 시트가 올라와 옷장 사진 / 한 벌씩을 고르게 함. 사진 스캔으로 저장한 뒤 옷이 빨랫줄에 걸리는 애니메이션이 안 나오던 문제 수정.
- 변경 파일:
  - `frontend/src/components/AddClothesSheet.tsx` — 신규(포털로 body 에 그림: 회전된 .box 안에서는 fixed 가 어긋남)
  - `frontend/src/pages/HomePage.tsx`, `CharacterPage.tsx` — 링크를 시트 버튼으로 교체
  - `frontend/src/pages/ScanClosetPage.tsx` — 저장한 옷 id 를 /wardrobe 로 state.hung 으로 전달(원인: state 없이 이동)
  - `frontend/src/styles/global.css` — .sheet-back/.sheet
- 프론트 연결 사항: 없음
- 검증 결과: frontend tsc/build 통과. 모바일 크기 브라우저에서 시트 표시·이동 확인. 스캔 저장 후 애니메이션은 AI 호출이 필요해 실제로 못 돌려 봄(코드상 한 벌씩 추가와 같은 경로).
- 남은 일 / 상대에게 요청: 커밋 안 함. 빈 옷장일 때 옷장 탭 화면은 기존대로 두 버튼이 바로 보임.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 웹푸시 켜기 (작성: Claude Code)
- 수정 목적: 베타 알림 테스트. VAPID 3개 환경변수는 사용자가 Render 에 입력함.
- 변경 파일:
  - `frontend/src/config/features.ts` — PUSH_ENABLED=true
- 프론트 연결 사항: 첫 진입 알림 허용 화면, 설정의 알림 메뉴가 열린다.
- 검증 결과: frontend tsc/build 통과, lint 는 기존 경고만. 실제 폰 수신은 사용자 확인 필요.
- 남은 일 / 상대에게 요청: 서버 상시 깨우기(외부 크론) 확인. 아침 알림 외에 비·후기는 반응 보고 조정.
- 적용한 규칙 번호: 해당 없음

### 2026-10-05 푸시 구독 주소 검증 + 알림 하루 상한 (작성: Claude Code)
- 수정 목적: 푸시를 켜기 전 준비. 구독 endpoint 를 브라우저 푸시 서비스 도메인(https)만 받고(SSRF 방지, 알려진 문제 P1 해결), 알림이 많아 끄는 일을 막기 위해 하루 상한을 둔다.
- 변경 파일:
  - `backend/src/services/push/endpoint.ts` — 신규. fcm.googleapis.com / mozilla / apple / windows 도메인만 허용(테스트 환경은 push.example 허용)
  - `backend/src/api/routes/push.ts` — 구독 스키마에 endpoint 검증 추가(실패 400)
  - `backend/src/jobs/dailyPushJob.ts` — 하루 2개(DAILY_PUSH_CAP), 후기 요청 7일 3회(FEEDBACK_PER_WEEK) 상한. 일정 알림은 대상 아님
  - `backend/tests/integration/daily-push.test.ts` — 상한 2건, 구독 주소 검증 테스트 추가
- 프론트 연결 사항: 없음(허용 도메인 밖 주소는 400. 정상 브라우저는 해당 없음). `PUSH_ENABLED` 는 아직 false 그대로.
- 검증 결과: backend typecheck/lint 통과, npm test 555 통과 / 1 실패. 실패는 "미세먼지 나쁨 + 켜짐이면 아침 알림에 마스크" 테스트로, 이번 변경 전(커밋 609f5c8)에도 동일하게 실패함(원인 미조사, 테스트 DB 의 대기질 캐시 의심).
- 남은 일 / 상대에게 요청: 위 미세먼지 테스트 원인 조사. 푸시 재개(U-2): VAPID 키 생성·Render 입력, 서버 상시 가동, PUSH_ENABLED=true. 베타 초반엔 아침 알림만 켜는 스위치 검토. 커밋은 하지 않음.
- 적용한 규칙 번호: B-8

### 2026-10-04 베타·플레이스토어 준비 점검 보고 (작성: Claude Code)
- 수정 목적: 사용자 요청으로 타겟·보안·고도화·수익화·베타 방법을 점검해 보고. 서비스 코드 수정 없음.
- 변경 파일: `HANDOFF.md` — 이 기록
- 프론트 연결 사항: 없음
- 검증 결과: 코드 읽기만. 새로 찾은 것(실측 필요): (1) 세션 쿠키 `rolling` 미설정 → 쿠키가 로그인 30일 뒤 만료, 게스트는 계정 복구 불가(`app.ts`) (2) `trust proxy 1` + Vercel rewrite → `req.ip` 가 Vercel IP 일 가능성, IP 제한(게스트 20회/분 등)을 전원이 공유할 수 있음 (3) 콜드스타트 동안 `loading` 이면 빈 화면(`App.tsx` `return null`, `api.ts` 타임아웃 없음) (4) 게스트 계정 정리 작업 없음 (5) 개인정보 안내에 국외 이전(Gemini) 항목·만 14세 기준 없음, 탈퇴 문구와 AiCallLog 익명화 불일치 (6) TWA 용 `assetlinks.json`·maskable 아이콘·공개 개인정보/계정삭제 URL 없음 (7) 관리자 비밀번호 로그인 시 세션 재생성 없음 (8) 오류 수집 도구 없음. 작업 폴더에 HANDOFF 에 기록되지 않은 미커밋 변경 있음(`dailyVariety` 등 → 이후 `bdef516` 로 커밋됨, 이 기록이 빠져 있음).
- 추가: 사용자가 전달한 GPT 의견을 코드와 대조해 4번 "베타 점검 합의" 표로 합침. GPT 주장 중 확인됨: 겉옷 제거 후처리, 일정 장소 대체, Discord 본문 전송, AI 한도 fail-open·30초 캐시, URL 로그, 마포구 기본값, 빈 옷장 추천 가림, 둘러보기 google 이동, 캐릭터 캐시, 관리자 세션 재생성, 푸시 endpoint. 과장: 캘린더 SSRF(검사 있음). GPT 가 놓친 것: rolling 쿠키, trust proxy IP.
- 남은 일: 4번 표의 ❓ 결정 후 P0 부터 진행.
- 적용한 규칙 번호: L-2, L-11, S-5, 9번

### 2026-10-04 칭호 정리: 사계절 준비 완료·균형 잡힌 옷장 제거, 무지개 7색 (작성: Claude Code)
- 수정 목적: 옷장을 찍으면 거의 누구나 받는 무난한 칭호를 없애 특이한 칭호가 대표·부칭호로 보이게 함.
- 변경 파일: `backend/src/services/character/analysis.ts`(두 칭호 제거, 무지개 6→7색·유채색 비율 최소 7벌), `backend/tests/unit/characterAnalysis.test.ts`, `frontend/src/lib/character.ts`·`components/CharacterDecor.tsx`·`components/ThemeScribble.tsx`(해당 key 제거), `CharacterPage.tsx`·`legalText.ts`(도감·FAQ 문구), `PROJECT_RULES.md`(17종→15종)
- 프론트 연결 사항: 칭호 key 15종으로 양쪽 일치. 이미 저장된 ALL_SEASON/BALANCED 값이 있으면 기본 복장으로 표시됨(저장 위치 확인 필요).
- 검증 결과: backend typecheck, characterAnalysis 테스트 49개 통과, frontend tsc 통과.
- 남은 일: 없음
- 적용한 규칙 번호: R-13

### 2026-10-04 AI 공통 한도(자동 설명 포함) · 탈퇴 시 AI 기록 익명화 · 오래된 설명 처리 · 게스트→카카오 점검 (작성: Claude Code)
- 수정 목적: 베타 전 작업 1~4. (1) 자동 설명도 사진·말과 같은 한도·서버 전체 상한을 따르게 함 (2) 탈퇴 시 AiCallLog 의 userId 제거 (3) 설명을 만들 때의 조건을 저장하고 현재와 다르면 템플릿 표시 (4) 게스트→카카오 전환 경고 점검(코드 확인만, 수정 안 함).
- 변경 파일 (커밋 `76207d4`):
  - `backend/src/services/ai/aiQuota.ts` — `reserveExplain`(진행 중 호출을 메모리 카운터로 세어 동시 우회 방지, 사용자 24h `AI_EXPLAIN_DAILY` 20 + 서버 전체 합산)
  - `backend/src/services/recommendationService.ts` — 한도 걸리면 AI 호출 없이 템플릿 저장, 조건 메타 저장, `viewOf` 에서 현재 조건과 비교, `storedOf`(외출 구간 `outing` 저장)
  - `backend/src/services/ai/explainBasis.ts` — 신규(조건 basis·비교·표시 판단), `aiLog.ts` — 신규(`recordAiCall`, FK 위반 시 userId 없이 재기록), `explain.ts`(반환 `{text, source}`), `gemini.ts`, `aiScope.ts`(`explain` 종류, `runWithAiScope`), `aiUsageReport.ts`, `routes/admin.ts`, `config/env.ts`
  - `backend/prisma/schema.prisma` + 마이그레이션 `20261004120000_ai_call_log_user_fk`(AiCallLog.userId FK ON DELETE SET NULL, 기존 고아 값 비움), `20261004130000_recommendation_explanation_meta`(Recommendation.aiExplanationMeta JSONB)
  - `frontend/src/types.ts`, `frontend/src/pages/AdminPage.tsx` — 응답 필드 반영
  - 테스트 신규: `tests/unit/aiExplainQuota`, `explainBasis`, `tests/integration/ai-explain-limit`, `ai-explain-stale`, `ai-withdraw`
- 프론트 연결 사항: 추천 응답에 `aiExplanationSource`('ai'|'template'|null) 추가(화면은 `aiExplanation` 을 그대로 표시, 변경 없음). 관리자 `/ai-usage` 응답에 `days[].explain`, `topUsers[].explain`, `limits.explainDaily` 추가. 에러 코드 변경 없음(설명 한도는 에러가 아니라 템플릿 대체).
- 검증 결과: `backend npm run typecheck` 통과 / `npm run lint` 출력 없음 / `npx vitest run` 43파일 중 42 통과(543/551) — 실패 1건은 변경 없이도 실패하는 기존 테스트(`ai.test.ts` "격식 있는 옷이 부족하면…", 문구 기대값 불일치, 원인 미조사) / `prisma migrate status` 개발 DB 최신, 테스트 DB 와 `migrate diff` 차이 없음 / `frontend tsc -p tsconfig.app.json` 통과, `npm run lint` 에러 없음(경고 19줄), `npm run build` 통과. 테스트 DB 에 기존 마이그레이션 2개가 빠져 있어 `migrate deploy` 로 적용함. 못 한 것: 실제 Gemini·기상청 호출 검증, 서버 여러 대 환경(카운터는 프로세스 메모리), 브라우저 화면 확인.
- 남은 일 / 상대에게 요청:
  - 4번 결과(수정 안 함): 카카오 연결 **전** 경고는 없다. 설정 > 계정의 연결 버튼 문구와 FAQ 가 "그대로 이어서 쓸 수 있어요"라고만 안내해, 이미 가입된 카카오 계정이면 사실과 다르다. 사후 안내(`GuestDataNotice`)만 있다(로그인 직후 한 번, 옷·일정이 있을 때만). 서버는 OAuth 콜백 전에는 계정 존재를 알 수 없다. 제안: A 버튼 문구에 예외 한 줄 추가(작음) / B 콜백에서 즉시 전환하지 않고 확인 화면(기존 계정으로 로그인하면 게스트 데이터는 이어지지 않음) 추가(중간) / C 병합(크고 규칙과 충돌). 게스트 User 행은 삭제되지 않고 남는다.
  - 개인정보 안내문(`legalText.ts`)에 "탈퇴하면 AI 호출 기록에서 사용자 식별 정보가 제거돼요" 문구 추가 여부 결정 필요. 호출 기록은 삭제가 아니라 익명화(서버 전체 상한 유지 목적) — 삭제 원하면 알려줄 것.
  - 설명 한도(20회), 기온대 크기(5°C, `TEMP_BAND_SIZE`)는 임시값 — 첫 주 호출 기록 보고 조정. 한도로 저장된 템플릿은 그날 AI 설명으로 바뀌지 않음.
  - 서버가 여러 대가 되면 `reserveExplain` 을 DB 선점으로 교체. 사진·문장 경로에는 같은 동시성 보강을 하지 않았다(시간당 제한이 있어 제외).
- 적용한 규칙 번호: R-8, R-9, R-11, S-5, S-6, B-5

### 2026-10-04 베타 전 작업 계획 정리 (작성: Claude Code)
- 수정 목적: GPT 베타 분석과 Claude 의견을 합의해 4번 "다음 작업"·5번 "요청"에 반영. 서비스 코드 수정 없음.
- 변경 파일: `HANDOFF.md` — 4·5번 갱신
- 프론트 연결 사항: 없음
- 검증 결과: 코드로 확인한 것 — `AiCallLog.userId` 는 User 와 FK 없음(`schema.prisma`), 자동 설명은 `aiEnabled()` 만 보고 호출(`recommendationService.ts:258-262`). 실행한 테스트 없음.
- 문서 상태: 파일 `PROJECT_RULES.md`, `HANDOFF.md`, `CLAUDE.md`, `AGENTS.md` / 브랜치 `main` / 마지막 커밋 `22efa30` / **4개 모두 아직 커밋·푸시되지 않음(untracked)**
- 남은 일: 문서 커밋은 사용자 요청 시.
- 적용한 규칙 번호: R-8, R-11

### 2026-10-04 협업 문서 정리 (작성: Claude Code)
- 수정 목적: Claude(프론트)/Codex(백엔드) 교대 작업용 공통 문서 작성. 서비스 코드 수정 없음.
- 변경 파일:
  - `PROJECT_RULES.md` — 신규 (디자인·백엔드·인증·API·담당·미결정)
  - `HANDOFF.md` — 신규
  - `CLAUDE.md`, `AGENTS.md` — 신규 (기존 파일은 프로젝트에 없었음)
- 프론트 연결 사항: 없음
- 검증 결과: 코드 읽기로 작성. 일부 줄 번호·오류 코드는 전수 대조 못 함(알려진 문제 6). 빌드/테스트는 코드 변경이 없어 실행 안 함.
- 남은 일: 없음.
- 적용한 규칙 번호: 해당 없음
