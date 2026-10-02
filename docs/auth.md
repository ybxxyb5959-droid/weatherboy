# 인증 설계

지원: **카카오 로그인**, **Guest(로그인 없이 둘러보기)**. Google/Apple/이메일 로그인은 구현하지 않았지만 `AuthProvider` enum 에 값만 추가하면 되는 구조다.

## 데이터 모델

- `User` — 서비스 데이터의 주인(설정, 옷장, 일정, 피드백, 구독 모두 `userId` 로 연결). 인증 수단과 무관.
- `AuthIdentity(provider, providerUserId)` — unique. 한 User 에 여러 Identity 를 붙일 수 있다.
  - `KAKAO`: `providerUserId` = Kakao 회원번호(`id`), `nickname/profileImageUrl/email` 은 로그인 때 갱신
  - `GUEST`: `providerUserId` = 서버가 만든 랜덤 UUID

## Guest

`POST /api/auth/guest` → User + GUEST Identity 생성 → 세션 생성. 이후 모든 API 를 Kakao 사용자와 동일하게 사용한다.

### Guest → Kakao 전환
Guest 세션에서 Kakao 로그인을 마치면, 그 Kakao 계정이 **처음 보는 계정**이면 기존 Guest User 에 KAKAO Identity 를 추가한다(데이터 유지). 이미 다른 User 에 연결된 Kakao 계정이면 그 User 로 로그인한다(Guest 데이터는 병합하지 않음 — MVP 범위, UI 없음).

## Kakao OAuth (Backend Redirect)

```
GET /api/auth/kakao
  state = random(24 bytes) → 세션 저장 → 302 https://kauth.kakao.com/oauth/authorize
        ?client_id&redirect_uri&response_type=code&state
GET /api/auth/kakao/callback?code&state
  state 비교(1회용, 불일치 시 실패) → POST https://kauth.kakao.com/oauth/token
  → GET https://kapi.kakao.com/v2/user/me (Bearer) → AuthIdentity 조회/생성
  → 세션 재생성(session fixation 방지) → 302 FRONTEND_ORIGIN/setup | /home
```
- Kakao access token 은 프로필 조회 직후 버리며 DB/로그에 저장하지 않는다. 요청 scope 는 기본(닉네임/프로필 사진)만 사용하고 이메일 동의항목은 요청하지 않는다.
- 필요 환경변수: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(앱에서 Client Secret 을 활성화한 경우), `KAKAO_REDIRECT_URI`.
- Kakao Developers 에서 해당 Redirect URI 를 등록해야 한다(→ README "직접 해야 하는 설정").

## 세션

- `express-session` + `connect-pg-simple`(테이블 `session`, Prisma migration 으로 생성)
- 쿠키 `wb.sid`: `HttpOnly`, `SameSite=Lax`, Production 에서 `Secure`, 30일
- `trust proxy = 1` (Nginx 뒤에서 `X-Forwarded-Proto` 로 secure 판단)
- CSRF: SameSite=Lax + JSON body + CORS(`FRONTEND_ORIGIN` 만) + 상태 변경 요청 Origin 검사

## 검증 상태

Guest/세션/로그아웃/권한은 통합 테스트로 검증한다(DB 필요). Kakao Flow 는 **외부 호출을 Mock 한 내부 Flow 테스트**(state 검증, 사용자 생성, Guest 연결)만 있고, **실제 Kakao 서버 호출은 미검증**(Kakao 앱 키 필요).
