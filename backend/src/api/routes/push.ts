import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const pushRouter = Router()
pushRouter.use(requireAuth)

// 브라우저 PushSubscription.toJSON() 형태
const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

// 프론트가 pushManager.subscribe({ applicationServerKey }) 에 쓸 공개키 (공개키는 비밀이 아니다)
pushRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY || null })
})

pushRouter.post(
  '/subscribe',
  wrap(async (req, res) => {
    const b = parse(subscribeSchema, req.body)
    const userId = (req as AuthedRequest).userId
    await prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      create: { userId, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
      update: { userId, p256dh: b.keys.p256dh, auth: b.keys.auth },
    })
    res.status(201).json({ ok: true })
  }),
)

pushRouter.delete(
  '/subscribe',
  wrap(async (req, res) => {
    const b = parse(z.object({ endpoint: z.string().url() }), req.body)
    await prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId: (req as AuthedRequest).userId } })
    res.status(204).end()
  }),
)
