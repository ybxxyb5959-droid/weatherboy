import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { isAllowedPushEndpoint } from '../../services/push/endpoint.js'
import { sendToUser } from '../../services/push/push.js'
import { AppError } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const pushRouter = Router()
pushRouter.use(requireAuth)

// 브라우저 PushSubscription.toJSON() 형태
const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000).refine(isAllowedPushEndpoint, '지원하지 않는 알림 주소예요'),
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

// 내 기기로 시험 알림 1건을 보낸다(설정 화면의 "알림 시험"). 방해금지 시간은 무시하고, 성공하면 30초에 한 번(실패는 5초 뒤 다시 시도 가능).
pushRouter.post(
  '/test',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const recent = await prisma.notifyLog.findFirst({ where: { userId, kind: 'TEST', OR: [{ status: 'SENT', createdAt: { gte: new Date(Date.now() - 30_000) } }, { createdAt: { gte: new Date(Date.now() - 5_000) } }] }, select: { id: true } })
    if (recent) throw new AppError(429, 'TOO_MANY', '잠시 뒤에 다시 눌러주세요.')
    const outcome = await sendToUser(userId, null, { title: '알림 시험', body: '이 알림이 보이면 휴대폰 알림이 잘 켜진 거예요.', url: '/home', tag: 'test' }, { kind: 'TEST', ignoreQuiet: true })
    // 실패했을 때는 사유(상태 코드와 오류 문구, 비밀값 아님)를 같이 돌려줘 원인을 바로 볼 수 있게 한다
    const failed = outcome === 'FAILED' ? await prisma.notifyLog.findFirst({ where: { userId, kind: 'TEST', status: 'FAILED' }, orderBy: { createdAt: 'desc' }, select: { message: true } }) : null
    res.json({ outcome, detail: failed?.message ?? null })
  }),
)
