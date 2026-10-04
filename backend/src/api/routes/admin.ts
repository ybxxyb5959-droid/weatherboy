import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { AppError, notFound } from '../../utils/errors.js'
import { avgMsByKind, buildDays, failureRate, type UsageRow } from '../../services/ai/aiUsageReport.js'
import { getGlobalUsage } from '../../services/ai/aiQuota.js'
import { MIN_CLOTHES } from '../../services/character/analysis.js'
import { parse, requireAdmin, wrap } from '../middleware/common.js'

export const adminRouter = Router()

// ───── 관리자 로그인(비밀번호) ─────
// ADMIN_PASSWORD 환경변수와 맞으면 12시간 동안 관리자 세션이 된다. 값이 없으면 이 기능은 꺼져 있다.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '시도가 너무 많아요. 잠시 후 다시 해주세요.' },
})
const sha = (s: string) => createHash('sha256').update(s).digest()

adminRouter.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    if (!env.ADMIN_PASSWORD) throw notFound()
    const { password } = parse(z.object({ password: z.string().min(1).max(200) }), req.body)
    // 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교한다
    if (!timingSafeEqual(sha(password), sha(env.ADMIN_PASSWORD))) throw new AppError(401, 'BAD_PASSWORD', '비밀번호가 맞지 않아요.')
    req.session.adminAt = Date.now()
    res.json({ ok: true })
  }),
)

adminRouter.post('/logout', (req, res) => {
  delete req.session.adminAt
  res.json({ ok: true })
})

// 여기부터는 관리자만
adminRouter.use(requireAdmin)

adminRouter.get('/me', (_req, res) => {
  res.json({ ok: true })
})

adminRouter.get(
  '/ops/summary',
  wrap(async (_req, res) => {
    const since = new Date(Date.now() - 24 * 3600_000)
    const [collect, notify, aiTotal, aiFallback, recentErrors] = await Promise.all([
      prisma.collectLog.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true }),
      prisma.notifyLog.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: true }),
      prisma.aiCallLog.count({ where: { createdAt: { gte: since } } }),
      prisma.aiCallLog.count({ where: { createdAt: { gte: since }, fallback: true } }),
      prisma.collectLog.findMany({ where: { status: { in: ['FAILED', 'PARTIAL'] } }, orderBy: { createdAt: 'desc' }, take: 10, select: { job: true, target: true, status: true, message: true, createdAt: true } }),
    ])
    const toMap = (rows: { status: string; _count: number }[]) => Object.fromEntries(rows.map((r) => [r.status, r._count]))
    res.json({
      windowHours: 24,
      collect: toMap(collect),
      push: toMap(notify),
      ai: { calls: aiTotal, fallbacks: aiFallback },
      recentErrors,
    })
  }),
)

// ───── AI 사용 현황: 하루/종류별 호출, 실패율, 상위 사용자, 한도 설정 ─────
adminRouter.get(
  '/ai-usage',
  wrap(async (_req, res) => {
    const DAYS = 7
    const since = new Date(Date.now() - DAYS * 86400_000)
    const since24h = new Date(Date.now() - 86400_000)
    const [raw, top, g] = await Promise.all([
      prisma.$queryRaw<{ d: string; kind: string | null; status: 'SUCCESS' | 'FAILED'; c: number; avg_ms: number | null }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d, "kind", "status"::text AS status,
               COUNT(*)::int AS c, AVG("durationMs")::int AS avg_ms
        FROM "AiCallLog" WHERE "createdAt" >= ${since} GROUP BY 1, 2, 3`,
      prisma.aiCallLog.groupBy({ by: ['userId', 'kind'], where: { createdAt: { gte: since24h }, userId: { not: null } }, _count: true }),
      getGlobalUsage(),
    ])
    const rows: UsageRow[] = raw.map((r) => ({ d: r.d, kind: r.kind, status: r.status, c: r.c, avgMs: r.avg_ms }))
    const days = buildDays(rows, DAYS)
    // 최근 24시간 상위 사용자(고객번호만 보여준다: 사용자 ID 앞 8자리)
    const perUser = new Map<string, { photo: number; text: number }>()
    for (const t of top) {
      const cur = perUser.get(t.userId!) ?? { photo: 0, text: 0 }
      if (t.kind === 'photo') cur.photo += t._count
      else if (t.kind === 'text') cur.text += t._count
      perUser.set(t.userId!, cur)
    }
    const topUsers = [...perUser.entries()]
      .map(([id, v]) => ({ code: id.slice(0, 8).toUpperCase(), photo: v.photo, text: v.text, total: v.photo + v.text }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    res.json({
      days,
      failureRate: failureRate(days),
      avgMs: avgMsByKind(rows),
      topUsers,
      global: { used: g.used, cap: g.cap, open: g.open },
      limits: {
        photoDaily: env.AI_PHOTO_DAILY,
        photoNewUser: env.AI_PHOTO_NEWUSER,
        textDaily: env.AI_TEXT_DAILY,
        textNewUser: env.AI_TEXT_NEWUSER,
        newUserHours: env.AI_NEWUSER_HOURS,
        hourly: 60,
      },
    })
  }),
)

// ───── 대시보드: 가입자·접속·퍼널·후기 ─────
adminRouter.get(
  '/dashboard',
  wrap(async (_req, res) => {
    const now = Date.now()
    const day = 24 * 3600_000
    const [total, byProvider, active24h, active7d, daily, funnel, eventUsers, locationUsers, reviewAgg, unread, supportTotal, supportUnread] = await Promise.all([
      prisma.user.count(),
      prisma.authIdentity.groupBy({ by: ['provider'], _count: { userId: true } }),
      prisma.user.count({ where: { lastSeenAt: { gte: new Date(now - day) } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: new Date(now - 7 * day) } } }),
      // 최근 7일 일별 신규 가입(한국 시간 기준 날짜)
      prisma.$queryRaw<{ d: string; c: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d, count(*)::int AS c
        FROM "User" WHERE "createdAt" >= NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
      // 직접 담은 옷(예시 옷 제외)이 1벌 이상 / 캐릭터가 열리는 벌 수(MIN_CLOTHES) 이상인 사용자 수
      prisma.$queryRaw<{ c1: number; c5: number }[]>`
        SELECT (count(*) FILTER (WHERE n >= 1))::int AS c1, (count(*) FILTER (WHERE n >= ${MIN_CLOTHES}))::int AS c5
        FROM (SELECT "userId", count(*) AS n FROM "Clothing" WHERE "isSample" = false AND active = true GROUP BY "userId") t`,
      prisma.$queryRaw<{ c: number }[]>`SELECT count(DISTINCT "userId")::int AS c FROM "Event"`,
      prisma.user.count({ where: { regionSido: { not: null } } }),
      prisma.appReview.aggregate({ _count: true, _avg: { rating: true } }),
      prisma.appReview.count({ where: { readAt: null } }),
      prisma.supportMessage.count(),
      prisma.supportMessage.count({ where: { readAt: null } }),
    ])
    const prov = Object.fromEntries(byProvider.map((p) => [p.provider, p._count.userId]))
    const f = funnel[0] ?? { c1: 0, c5: 0 }
    res.json({
      users: { total, kakao: prov.KAKAO ?? 0, guest: prov.GUEST ?? 0, active24h, active7d },
      daily,
      // 가입 -> 위치 설정 -> 옷 1벌 -> 옷 MIN_CLOTHES 벌(캐릭터 해금) -> 일정 등록: 어디서 떠나는지 본다
      funnel: [
        { step: '가입', count: total },
        { step: '내 지역 설정', count: locationUsers },
        { step: '옷 1벌 이상', count: f.c1 },
        { step: `옷 ${MIN_CLOTHES}벌 이상`, count: f.c5 },
        { step: '일정 등록', count: eventUsers[0]?.c ?? 0 },
      ],
      reviews: { total: reviewAgg._count, average: reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : null, unread },
      support: { total: supportTotal, unread: supportUnread },
    })
  }),
)

// 후기 목록(최신순). 닉네임/이메일은 주지 않고 짧은 사용자 코드만 보여준다.
adminRouter.get(
  '/reviews',
  wrap(async (_req, res) => {
    const rows = await prisma.appReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { activeDays: true, identities: { select: { provider: true }, take: 1 } } } },
    })
    res.json(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        message: r.message,
        createdAt: r.createdAt,
        read: !!r.readAt,
        code: r.userId.slice(0, 8).toUpperCase(),
        provider: r.user.identities[0]?.provider ?? null,
        activeDays: r.user.activeDays,
      })),
    )
  }),
)

adminRouter.post(
  '/reviews/:id/read',
  wrap(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    await prisma.appReview.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } })
    res.json({ ok: true })
  }),
)

// 의견·제보 목록(최신순). 후기와 같이 닉네임/이메일 없이 짧은 사용자 코드만.
adminRouter.get(
  '/support',
  wrap(async (_req, res) => {
    const rows = await prisma.supportMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { identities: { select: { provider: true }, take: 1 } } } },
    })
    res.json(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        message: r.message,
        createdAt: r.createdAt,
        read: !!r.readAt,
        code: r.userId.slice(0, 8).toUpperCase(),
        provider: r.user.identities[0]?.provider ?? null,
      })),
    )
  }),
)

adminRouter.post(
  '/support/:id/read',
  wrap(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    await prisma.supportMessage.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } })
    res.json({ ok: true })
  }),
)
