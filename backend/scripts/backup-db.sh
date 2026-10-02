#!/usr/bin/env bash
# PostgreSQL 백업 (pg_dump). 비밀번호는 코드에 넣지 않고 환경변수/.pgpass 로 전달한다.
# 사용: DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-db.sh [출력디렉터리]
#  또는 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE 환경변수.
# Docker Compose 로 돌리는 경우: BACKUP_VIA_DOCKER=1 ./scripts/backup-db.sh  (postgres 컨테이너 안의 pg_dump 사용)
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/weather_boy-$STAMP.dump"

if [[ "${BACKUP_VIA_DOCKER:-0}" == "1" ]]; then
  # POSTGRES_USER/POSTGRES_DB 는 컨테이너 환경변수를 사용(비밀번호 불필요: 컨테이너 내부 로컬 소켓)
  docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$FILE"
else
  : "${DATABASE_URL:?DATABASE_URL 또는 PG* 환경변수가 필요합니다}"
  pg_dump "$DATABASE_URL" -Fc -f "$FILE"
fi

echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"
# 30일 지난 백업 삭제
find "$OUT_DIR" -name 'weather_boy-*.dump' -mtime +30 -delete
