import crypto from 'node:crypto'
import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { buildAuthorizeUrl, fetchKakaoProfile, kakaoConfigured } from '../../services/kakao/kakaoAuth.js'
import { touchActivity } from '../../services/review/reviewPrompt.js'
import { serializeMe } from '../../services/serializers.js'
import { AppError, unauthorized } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import { requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

const limiter = (max: number) =>
  rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === 'test' ? 10_000 : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ code: 'RATE_LIMITED', message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' })
    },
  })

// 서버 전체 게스트 가입 상한(IP 를 속여 한도를 피하는 가입 폭주 방어). 한 사람의 정상 사용량에는 영향이 없다.
const guestGlobalLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 300,
  keyGenerator: () => 'all-guests',
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => !!req.session?.userId, // 이미 게스트/로그인 상태면 새 계정을 만들지 않으니 세지 않는다
  handler: (_req, res) => {
    res.status(429).json({ code: 'RATE_LIMITED', message: '지금 이용자가 몰려 있어요. 잠시 후 다시 시도해주세요.' })
  },
})

const regenerate = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())))
const save = (req: Request) => new Promise<void>((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())))

export const authRouter = Router()

// 로그인 없이 둘러보기: User + GUEST AuthIdentity + Session
authRouter.post(
  '/guest',
  limiter(20),
  guestGlobalLimiter,
  wrap(async (req, res) => {
    const existing = req.session.userId
    if (existing) {
      const u = await prisma.user.findUnique({ where: { id: existing }, include: { identities: true } })
      if (u) {
        res.json(serializeMe(u, u.identities))
        return
      }
    }
    const user = await prisma.user.create({
      data: { identities: { create: { provider: 'GUEST', providerUserId: crypto.randomUUID(), nickname: '게스트' } } },
      include: { identities: true },
    })
    await regenerate(req)
    req.session.userId = user.id
    await save(req)
    res.status(201).json(serializeMe(user, user.identities))
  }),
)

authRouter.get(
  '/kakao',
  limiter(20),
  wrap(async (req, res) => {
    if (!kakaoConfigured()) throw new AppError(503, 'KAKAO_NOT_CONFIGURED', '카카오 로그인이 아직 설정되지 않았어요.')
    const state = crypto.randomBytes(24).toString('hex')
    req.session.oauthState = state
    await save(req)
    res.redirect(buildAuthorizeUrl(state))
  }),
)

const fail = (res: import('express').Response, reason: string) =>
  res.redirect(`${env.FRONTEND_ORIGIN}/?login=failed&reason=${encodeURIComponent(reason)}`)

authRouter.get(
  '/kakao/callback',
  limiter(30),
  wrap(async (req, res) => {
    if (!kakaoConfigured()) throw new AppError(503, 'KAKAO_NOT_CONFIGURED', '카카오 로그인이 아직 설정되지 않았어요.')
    const { code, state, error } = req.query as Record<string, string | undefined>
    const expected = req.session.oauthState
    delete req.session.oauthState
    if (error) return fail(res, 'denied')
    if (!code || !state || !expected || state !== expected) return fail(res, 'state_mismatch')

    let profile
    try {
      profile = await fetchKakaoProfile(code)
    } catch (e) {
      logger.warn({ code: e instanceof AppError ? e.code : 'unknown' }, 'kakao login failed')
      return fail(res, 'kakao_error')
    }

    const previousUserId = req.session.userId
    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: 'KAKAO', providerUserId: profile.id } },
    })
    let userId: string
    // 이미 카카오로 쓰던 계정이 있으면 그 계정으로 들어간다. 지금 쓰던 게스트 데이터는 합치지 않는다(두 계정의 옷장·일정이 섞이는 걸 막기 위해).
    // 게스트에 직접 만든 데이터가 있었다면 화면에서 알려주도록 표시한다.
    let guestDataLeft = false
    if (identity) {
      userId = identity.userId
      if (previousUserId && previousUserId !== identity.userId) {
        const prev = await prisma.user.findFirst({ where: { id: previousUserId, identities: { every: { provider: 'GUEST' } } }, select: { id: true } })
        if (prev) {
          const [events, clothes] = await Promise.all([prisma.event.count({ where: { userId: prev.id } }), prisma.clothing.count({ where: { userId: prev.id, isSample: false, active: true } })])
          guestDataLeft = events + clothes > 0
        }
      }
      await prisma.authIdentity.update({
        where: { id: identity.id },
        data: { nickname: profile.nickname, profileImageUrl: profile.profileImageUrl, email: profile.email },
      })
    } else {
      const data = { provider: 'KAKAO' as const, providerUserId: profile.id, nickname: profile.nickname, profileImageUrl: profile.profileImageUrl, email: profile.email }
      // 게스트로 쓰던 User 가 있으면 그 User 에 Kakao 를 연결 (옷장/일정/피드백 유지)
      const guest = previousUserId
        ? await prisma.user.findFirst({ where: { id: previousUserId, identities: { every: { provider: 'GUEST' } } } })
        : null
      if (guest) {
        await prisma.authIdentity.create({ data: { ...data, userId: guest.id } })
        userId = guest.id
      } else {
        userId = (await prisma.user.create({ data: { identities: { create: data } } })).id
      }
    }

    await regenerate(req)
    req.session.userId = userId
    await save(req)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    res.redirect(`${env.FRONTEND_ORIGIN}${user.onboardingDone ? '/home' : '/setup'}${guestDataLeft ? '?guestData=left' : ''}`)
  }),
)

authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()))
    res.clearCookie('wb.sid', { path: '/' })
    res.json({ ok: true })
  }),
)

export const meRouter = Router()
meRouter.get(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: (req as AuthedRequest).userId }, include: { identities: true } })
    if (!u) {
      await new Promise<void>((resolve) => req.session.destroy(() => resolve()))
      throw unauthorized()
    }
    // 접속 기록(후기 요청 카드와 관리자 통계에 쓴다). 실패해도 응답에는 영향이 없다.
    const now = new Date()
    const t = touchActivity(u.lastSeenAt, u.activeDays, now)
    if (t.update) prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: now, activeDays: t.activeDays } }).catch(() => undefined)
    res.json(serializeMe(u, u.identities))
  }),
)

// 회원 탈퇴: 사용자의 모든 데이터(옷장/일정/즐겨찾기/추천/피드백/푸시 구독/로그인 연결)를 지운다.
// 관련 테이블은 모두 User 삭제 시 cascade 된다. 다른 기기의 세션도 함께 없앤다.
meRouter.delete(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "session" WHERE sess->>'userId' = ${userId}`,
      prisma.user.deleteMany({ where: { id: userId } }),
    ])
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()))
    res.clearCookie('wb.sid', { path: '/' })
    res.status(204).end()
  }),
)
