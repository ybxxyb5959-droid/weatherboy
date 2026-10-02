# 화면(프론트) + 서버(API/알림 작업)를 하나의 이미지로. 한 서버(Lightsail)에서 같은 주소로 서비스한다.
# 빌드: docker build -f Dockerfile.app -t weather-boy-app .

FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig*.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Seoul SERVE_FRONTEND_DIR=/app/public
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/package.json ./
COPY --from=web /web/dist ./public
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
