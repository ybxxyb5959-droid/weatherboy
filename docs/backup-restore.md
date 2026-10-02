# 백업 / 복구

## 백업
`backend/scripts/backup-db.sh` (pg_dump custom format, 날짜 기반 파일명, 30일 지난 파일 삭제). 비밀번호는 스크립트에 없다.

```bash
# 호스트에 pg_dump 가 있을 때
DATABASE_URL='postgresql://USER:PASS@HOST:5432/weather_boy' ./backend/scripts/backup-db.sh ./backups

# Docker Compose 의 postgres 컨테이너를 쓸 때
BACKUP_VIA_DOCKER=1 ./backend/scripts/backup-db.sh ./backups
```
Ubuntu cron 예(매일 04:10): `10 4 * * * cd /srv/weather-boy && BACKUP_VIA_DOCKER=1 ./backend/scripts/backup-db.sh /srv/backups`

## 복구 (반드시 **별도 DB** 에서 먼저 검증)
```bash
docker compose exec -T postgres createdb -U "$POSTGRES_USER" weather_boy_restore
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d weather_boy_restore --no-owner < backups/weather_boy-YYYYMMDD-HHMMSS.dump
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d weather_boy_restore -c 'SELECT count(*) FROM "User"; SELECT count(*) FROM "Clothing";'
```
운영 DB 로 되돌릴 때는 서비스를 멈추고(api/worker), 복구 검증된 덤프로 새 DB 를 만든 뒤 `DATABASE_URL` 을 교체하는 방식을 권장한다. 운영 DB 에 직접 `pg_restore --clean` 을 실행하지 않는다.

## 검증 기록
`docs/incidents/` 또는 최종 보고서의 "Backup → Restore" 항목 참고(개발 DB 대상).
