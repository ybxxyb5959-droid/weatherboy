# 배포 (Ubuntu + Docker Compose + Nginx)

> 이 구성은 로컬에서 **검증되지 않았다**(서버/도메인 없음). 절차 초안이다.

## 1. 서버 준비
Ubuntu 22.04+, Docker Engine + Compose plugin, Nginx, certbot. 방화벽은 80/443 만 연다(5432/4000 은 `127.0.0.1` 바인딩).

## 2. 환경변수
- 루트 `.env`(compose 용, Git 제외): `POSTGRES_PASSWORD=<강한 값>` (선택 `POSTGRES_USER`, `POSTGRES_DB`)
- `backend/.env`(Git 제외): `backend/.env.example` 를 복사해 채운다.
  - `NODE_ENV=production`, `FRONTEND_ORIGIN=https://<도메인>`, `SESSION_SECRET=$(openssl rand -hex 32)`
  - `KAKAO_*`(Redirect URI 는 `https://<도메인>/api/auth/kakao/callback`), `KMA_SERVICE_KEY`, `AIRKOREA_SERVICE_KEY`
  - VAPID 키 생성: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY/PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com`
  - compose 가 `DATABASE_URL` 을 주입하므로 `backend/.env` 의 `DATABASE_URL` 은 비워도 된다.

## 3. 실행
```bash
docker compose up -d --build            # postgres → migrate(1회) → api, worker
docker compose --profile monitoring up -d uptime-kuma   # 선택: 모니터링
curl -s localhost:4000/health ; curl -s localhost:4000/ready
```
`migrate` 서비스가 `prisma migrate deploy` 를 실행한다(데이터가 있는 DB 에서 `migrate reset` 금지).

## 4. Nginx + HTTPS
`infra/nginx/weather-boy.conf` 를 `/etc/nginx/sites-available/` 에 복사, 도메인 수정, `certbot --nginx -d <도메인>`. Frontend 는 `frontend` 에서 `npm run build` 후 `dist/` 를 `/var/www/weather-boy` 로 복사. `X-Forwarded-Proto` 와 Express `trust proxy` 덕분에 `Secure` 세션 쿠키가 정상 동작한다.

## 5. 운영
- 백업: `docs/backup-restore.md`
- 관리자 지정: Kakao 로그인 1회 후 `UPDATE "User" SET "isAdmin"=true WHERE id=(SELECT "userId" FROM "AuthIdentity" WHERE provider='KAKAO' AND "providerUserId"='<카카오 id>');`
- 모니터링: Uptime Kuma 에 `https://<도메인>/health` 등록. 지표는 `GET /api/admin/ops/summary`.
- 장애 기록은 `docs/incidents/YYYY-MM-DD-제목.md` 로 남긴다.

## 알림(Web Push) / VAPID 주의
- `VAPID_SUBJECT` 는 **실제 연락처**(`mailto:you@example.com` 또는 서비스 https 주소)로 바꾼다. `localhost` 값은 Apple 푸시 서버가 거부한다(개발용으로만 사용).
- 웹푸시는 Chrome/Edge/Firefox/Android 와 "홈 화면에 추가한 iOS PWA(16.4+)"에서 동작한다. **스토어에 올리는 네이티브 앱(WebView)** 에서는 웹푸시가 동작하지 않으므로 FCM/APNs 로 별도 구현해야 한다.
