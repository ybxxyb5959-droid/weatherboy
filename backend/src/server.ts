import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db.js'
import { logger } from './utils/logger.js'

const { app, pool } = createApp()
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening'))

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  server.close()
  await Promise.allSettled([prisma.$disconnect(), pool.end()])
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
