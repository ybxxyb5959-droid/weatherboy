#!/bin/sh
# Render 시작 스크립트: 마이그레이션 적용 후 서버 실행 (dockerCommand 의 따옴표 처리 문제를 피하려고 파일로 분리)
set -e
npx prisma migrate deploy
exec node dist/server.js
