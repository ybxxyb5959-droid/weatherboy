import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db.js'
import { logger } from './utils/logger.js'

const { app, pool } = createApp()
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening'))

// 무료 호스팅처럼 프로세스를 하나만 둘 때: 예약 작업(알림/날씨 수집/캘린더 동기화)을 같은 프로세스에서 시작한다
if (env.RUN_JOBS_IN_API) void import('./worker.js')

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  server.close()
  await Promise.allSettled([prisma.$disconnect(), pool.end()])
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
