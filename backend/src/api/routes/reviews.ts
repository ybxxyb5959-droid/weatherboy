import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { nextSnooze, shouldPromptReview, usedAllFeatures } from '../../services/review/reviewPrompt.js'
import { notifyNewReview } from '../../services/review/notifyOwner.js'
import { AppError } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

// 앱 후기: 사용자당 한 번. 후기를 남기면 후기 요청 카드는 다시 뜨지 않는다.
export const reviewsRouter = Router()
reviewsRouter.use(requireAuth)

const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해주세요.' },
})

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(1000).default(''),
})

// 지금 후기 카드를 보여줄지, 이미 후기를 남겼는지
reviewsRouter.get(
  '/status',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        characterJson: true,
        reviewDismissed: true,
        reviewSnoozeUntil: true,
        appReview: { select: { id: true } },
        _count: { select: { events: true, clothes: { where: { isSample: false, active: true } } } },
      },
    })
    const reviewed = !!u?.appReview
    // 캐릭터를 하나라도 꾸몄는가
    const cfg = u?.characterJson
    const decorated = !!cfg && typeof cfg === 'object' && !Array.isArray(cfg) && Object.values(cfg).some(Boolean)
    const usedAll = !!u && usedAllFeatures({ ownClothes: u._count.clothes, events: u._count.events, decorated })
    const show = !!u && shouldPromptReview({ createdAt: u.createdAt, usedAll, reviewed, dismissed: u.reviewDismissed, snoozeUntil: u.reviewSnoozeUntil }, new Date())
    res.json({ reviewed, show })
  }),
)

reviewsRouter.post(
  '/',
  writeLimiter,
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const body = parse(bodySchema, req.body)
    try {
      await prisma.appReview.create({ data: { userId, rating: body.rating, message: body.message } })
    } catch (e) {
      // userId 가 unique 라서, 이미 쓴 사람이 또 보내면 여기로 온다
      if ((e as { code?: string }).code === 'P2002') throw new AppError(409, 'ALREADY_REVIEWED', '이미 후기를 남겨주셨어요. 고마워요!')
      throw e
    }
    // 카드가 다시 뜨지 않게 같이 정리하고, 주인에게 알린다(알림 실패는 무시)
    await prisma.user.update({ where: { id: userId }, data: { reviewDismissed: true } })
    const [total, identity] = await Promise.all([prisma.appReview.count(), prisma.authIdentity.findFirst({ where: { userId }, select: { provider: true } })])
    void notifyNewReview({ rating: body.rating, message: body.message, code: userId.slice(0, 8).toUpperCase(), provider: identity?.provider ?? null, total })
    res.status(201).json({ ok: true })
  }),
)

// 나중에: 3일 뒤에 다시. 두 번 미루면 더 묻지 않는다.
reviewsRouter.post(
  '/snooze',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { reviewSnoozeCount: true } })
    const n = nextSnooze(u?.reviewSnoozeCount ?? 0, new Date())
    await prisma.user.update({ where: { id: userId }, data: { reviewSnoozeUntil: n.snoozeUntil, reviewSnoozeCount: n.snoozeCount, reviewDismissed: n.dismissed } })
    res.json({ ok: true })
  }),
)

// 다시 안 볼래요
reviewsRouter.post(
  '/dismiss',
  wrap(async (req, res) => {
    await prisma.user.update({ where: { id: (req as AuthedRequest).userId }, data: { reviewDismissed: true } })
    res.json({ ok: true })
  }),
)
