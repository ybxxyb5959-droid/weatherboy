import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { notifyNewSupport } from '../../services/review/notifyOwner.js'
import { AppError } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

// 의견·제보: 사용하다 불편하거나 바라는 점이 생겼을 때 언제든 여러 번 보낼 수 있다.
// (한 번만 받는 앱 후기는 /api/reviews)
export const supportRouter = Router()
supportRouter.use(requireAuth)

/** 도배 방지: 한 사람이 하루에 보낼 수 있는 개수 */
export const SUPPORT_DAILY_LIMIT = 5

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해주세요.' },
})

const bodySchema = z.object({
  kind: z.enum(['BUG', 'IDEA', 'OTHER']),
  message: z.string().trim().min(2).max(1000),
})

supportRouter.post(
  '/',
  limiter,
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const body = parse(bodySchema, req.body)
    const today = await prisma.supportMessage.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
    if (today >= SUPPORT_DAILY_LIMIT) throw new AppError(429, 'TOO_MANY', `하루에 ${SUPPORT_DAILY_LIMIT}번까지 보낼 수 있어요. 내일 또 보내주세요!`)
    await prisma.supportMessage.create({ data: { userId, kind: body.kind, message: body.message } })
    const identity = await prisma.authIdentity.findFirst({ where: { userId }, select: { provider: true } })
    void notifyNewSupport({ kind: body.kind, message: body.message, code: userId.slice(0, 8).toUpperCase(), provider: identity?.provider ?? null })
    res.status(201).json({ ok: true })
  }),
)
