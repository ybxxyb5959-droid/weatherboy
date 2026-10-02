import cors from 'cors'
import connectPgSimple from 'connect-pg-simple'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import pg from 'pg'
import { pinoHttp } from 'pino-http'
import { env, isProd } from './config/env.js'
import { prisma } from './db.js'
import { adminRouter } from './api/routes/admin.js'
import { authRouter, meRouter } from './api/routes/auth.js'
import { clothesRouter } from './api/routes/clothes.js'
import { aiRouter } from './api/routes/ai.js'
import { calendarRouter } from './api/routes/calendar.js'
import { eventsRouter } from './api/routes/events.js'
import { placesRouter } from './api/routes/places.js'
import { pushRouter } from './api/routes/push.js'
import { userRouter } from './api/routes/user.js'
import { recommendationsRouter, weatherRouter } from './api/routes/weather.js'
import { errorHandler, notFoundHandler, originGuard } from './api/middleware/common.js'
import { logger } from './utils/logger.js'

export function createApp() {
  const app = express()
  // Nginx 등 Reverse Proxy 뒤에서 secure cookie / client IP 가 올바르게 동작하도록
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }))
  app.use(helmet())
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }))
  // 사진(data URL)을 받는 AI 경로만 본문 한도를 크게 연다. 먼저 파싱되면 아래 기본 파서는 건너뛴다.
  app.use('/api/ai', express.json({ limit: '1mb' }))
  app.use(express.json({ limit: '100kb' }))

  // 프로세스 생존 확인
  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })
  // DB 연결 확인
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true, database: 'connected' })
    } catch {
      res.status(503).json({ ok: false, database: 'disconnected' })
    }
  })

  const PgStore = connectPgSimple(session)
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
  app.use(
    session({
      name: 'wb.sid',
      store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 30 * 24 * 3600_000 },
    }),
  )
  app.use(originGuard)

  app.use('/api/auth', authRouter)
  app.use('/api/me', meRouter)
  app.use('/api/clothes', clothesRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api/calendar', calendarRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/weather', weatherRouter)
  app.use('/api/recommendations', recommendationsRouter)
  app.use('/api/push', pushRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', userRouter) // /settings, /onboarding/complete, /geocode
  app.use('/api', placesRouter) // /places/suggest, /favorites

  app.use(notFoundHandler)
  app.use(errorHandler)
  return { app, pool }
}
