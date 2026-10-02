# Lightsail 한 대로 전체 앱 배포 (알림 포함, 내 PC 꺼도 동작)

구성: Lightsail 서버 1대(리눅스, **1GB = 월 7달러 플랜**) 안에 Docker 로 `postgres` + `api(서버+화면+알림 작업)` + `caddy(https)`.
주소는 무료 `sslip.io`(고정 IP 기반) 사용. 개발 DB 는 덤프로 옮긴다(원본은 그대로).

## 검증 결과 (로컬 Docker 로 확인한 것)
- 이미지 빌드 성공(`Dockerfile.app`, 크기 약 728MB), 개발 DB 덤프 복원 성공(사용자 506 / 옷 1371 / 일정 250 / 마이그레이션 15개, 복원 전후 동일).
- 서버 기동 시 마이그레이션 적용, 화면(`/`, `/home`), manifest, API(`/api/me`=401), `/health`, `/ready` 정상. 알림/날씨 수집/일정 점검 작업이 같은 프로세스에서 실행됨.
- 메모리(컨테이너 기준): api 약 45MB(실행 직후 보수적으로 100~110MB), postgres 약 47MB(튜닝 후). Docker·OS·Caddy 포함 전체 약 550~650MB 예상 → **1GB 에서 운영 가능**. 0.5GB($5) 플랜은 이미지 빌드/OS 여유가 없어 비추천.
- 안전장치: 컨테이너 메모리 상한(api 420MB, postgres 320MB, caddy 80MB), Node 힙 256MB, 서버에 **스왑 2GB** 추가(아래 3번).

## 비용 (AWS 공개 가격표 기준, 계정별 혜택은 콘솔에서 확인)
- 1GB 플랜(고정 IPv4 포함) **월 7달러**(약 1만 원). 0.5GB 는 월 5달러.
- IPv6 전용 1GB(월 5달러)는 쓰지 말 것: 외부 API(기상청 등)·Docker Hub 접속이 IPv4 필요.
- 신규 고객 90일 무료 체험 안내가 있다(AWS 프리 티어 페이지). 내 계정의 크레딧/체험 상태는 콘솔 Billing > Credits, Free Tier 에서 확인.
- 고정 IP(Static IP)는 인스턴스에 연결해 두면 무료. 연결 안 한 채 방치하면 요금이 생길 수 있다.
- 무료 체험이 끝나기 전에 계속 쓸지 결정(안 쓰면 인스턴스 삭제). 콘솔에서 예산 알림(Budgets) 1~5달러로 설정 권장.

## 서버 만들기 (확인 후 진행)
1. Lightsail > 인스턴스 생성: 리전 **서울(ap-northeast-2)**, Linux/Unix, OS only **Ubuntu 22.04/24.04**, 플랜 **월 7달러(1GB)**.
2. 네트워킹: **고정 IP 생성 후 인스턴스에 연결**, 방화벽에서 **TCP 80, 443 열기**(22는 본인만 가능하면 제한).
3. SSH 접속 후:
   ```bash
   # 스왑 2GB (1GB 서버 안전장치)
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   # Docker 설치
   curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER && newgrp docker
   ```
4. 코드 가져오기: `git clone <저장소>`(또는 scp 로 폴더 복사) 후 `cd weather_boy/deploy/lightsail`.
5. `.env` 만들기: `cp env.example .env` 후 채운다. `DOMAIN` 은 고정 IP 를 하이픈으로 바꾼 값 + `.sslip.io` (예: IP `13.125.0.1` → `13-125-0-1.sslip.io`). 로컬 `backend/.env` 의 키들(KMA, AIRKOREA, VAPID, 카카오, GEMINI)을 같은 이름으로 옮긴다. `POSTGRES_PASSWORD`, `SESSION_SECRET` 은 새로 만든 긴 랜덤 값.
6. 개발 DB 복원: 내 PC 의 `backups/weather_boy-dev-for-lightsail-20261002.dump` 를 서버의 `deploy/lightsail/restore/dev.dump` 로 복사(scp), 그다음:
   ```bash
   docker compose up -d postgres
   docker compose exec -T postgres pg_restore -U weather -d weather_boy --no-owner --no-privileges /restore/dev.dump
   docker compose up -d --build        # 마이그레이션 적용 + api + caddy
   ```
   (이미지 빌드는 1GB 서버에서 몇 분 걸릴 수 있다. 스왑이 있어야 안전하다.)
7. 확인: `https://<DOMAIN>/health` → `{"ok":true}`, 폰 크롬에서 `https://<DOMAIN>` 접속 → 홈 화면에 추가 → 위치/알림 허용.
8. 카카오 로그인을 쓰면 카카오 개발자 콘솔 Redirect URI 에 `https://<DOMAIN>/api/auth/kakao/callback` 등록.

## 주의
- **개발 DB 에는 테스트 계정이 많다**(사용자 506). 그대로 복원하면 알림 작업이 그 계정들의 구독도 점검한다(키가 맞지 않거나 만료된 구독은 자동 정리됨). 내 계정만 남기고 싶으면 복원 후 정리 가능.
- 이 PC 의 개발 DB 는 건드리지 않았다(덤프만 떠 둠). `backups/` 는 Git 에서 제외돼 있다.
- 비밀값이 든 `.env` 는 서버에만 두고 Git 에 올리지 않는다.
- 무료 도메인 대안: DuckDNS(가입/토큰 필요). sslip.io 는 가입 없이 쓰는 대신 Let's Encrypt 공용 한도에 걸릴 수 있다(걸리면 DuckDNS 로).
- 서버 갱신: `git pull && docker compose up -d --build`.
- 백업(서버): `docker compose exec -T postgres pg_dump -U weather -d weather_boy -Fc > backup.dump`.
