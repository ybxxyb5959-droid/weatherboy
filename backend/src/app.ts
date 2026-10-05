import cors from 'cors'
import connectPgSimple from 'connect-pg-simple'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import session from 'express-session'
import helmet from 'helmet'
import pg from 'pg'
import { pinoHttp } from 'pino-http'
import { renewSession, SESSION_MAX_AGE_MS } from './api/middleware/sessionRenew.js'
import { maskedReqSerializer } from './utils/maskUrl.js'
import { trustProxyHops } from './utils/trustProxy.js'
import { env, isProd } from './config/env.js'
import { prisma } from './db.js'
import { adminRouter } from './api/routes/admin.js'
import { authRouter, meRouter } from './api/routes/auth.js'
import { clothesRouter } from './api/routes/clothes.js'
import { aiRouter } from './api/routes/ai.js'
import { calendarRouter } from './api/routes/calendar.js'
import { characterRouter } from './api/routes/character.js'
import { eventsRouter } from './api/routes/events.js'
import { placesRouter } from './api/routes/places.js'
import { pushRouter } from './api/routes/push.js'
import { userRouter } from './api/routes/user.js'
import { recommendationsRouter, weatherRouter } from './api/routes/weather.js'
import { reviewsRouter } from './api/routes/reviews.js'
import { supportRouter } from './api/routes/support.js'
import { errorHandler, notFoundHandler, originGuard } from './api/middleware/common.js'
import { logger } from './utils/logger.js'

export function createApp() {
  const app = express()
  // Nginx 등 Reverse Proxy 뒤에서 secure cookie / client IP 가 올바르게 동작하도록
  app.set('trust proxy', trustProxyHops(env.TRUST_PROXY_HOPS, !!process.env.RENDER))
  app.disable('x-powered-by')

  // 요청 로그에는 쿼리 값(위치 좌표, 카카오 로그인 code 등)을 남기지 않는다
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' }, serializers: { req: maskedReqSerializer } }))
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
      cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: SESSION_MAX_AGE_MS },
    }),
  )
  app.use(renewSession) // 쓰는 동안 로그인 유지(마지막으로 쓴 날부터 30일)
  app.use(originGuard)

  app.use('/api/auth', authRouter)
  app.use('/api/me', meRouter)
  app.use('/api/clothes', clothesRouter)
  app.use('/api/character', characterRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api/calendar', calendarRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/weather', weatherRouter)
  app.use('/api/recommendations', recommendationsRouter)
  app.use('/api/push', pushRouter)
  app.use('/api/reviews', reviewsRouter)
  app.use('/api/support', supportRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api', userRouter) // /settings, /onboarding/complete, /geocode
  app.use('/api', placesRouter) // /places/suggest, /favorites

  // 화면(정적 파일)도 같이 서비스: 같은 주소라 로그인 쿠키가 그대로 동작한다. /api 가 아닌 GET 은 화면(index.html)으로 보낸다.
  if (env.SERVE_FRONTEND_DIR) {
    const dir = path.resolve(env.SERVE_FRONTEND_DIR)
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`SERVE_FRONTEND_DIR 에 index.html 이 없어요: ${dir}`)
    // 서비스워커/설치 정보는 캐시하지 않아야 업데이트가 바로 반영된다
    const noCache = new Set(['sw.js', 'manifest.webmanifest', 'index.html'])
    app.use(express.static(dir, { setHeaders: (res, file) => { if (noCache.has(path.basename(file))) res.setHeader('Cache-Control', 'no-cache') } }))
    app.get(/^\/(?!api\/|health|ready).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(dir, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)
  return { app, pool }
}
