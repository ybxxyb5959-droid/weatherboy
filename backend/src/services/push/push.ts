import webpush from 'web-push'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { isQuietHoursKst } from '../../utils/time.js'
import { logger } from '../../utils/logger.js'

export const pushConfigured = () => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)

let initialized = false
function init() {
  if (initialized) return
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  initialized = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

export type PushOutcome = 'SENT' | 'FAILED' | 'QUIET' | 'NO_SUBSCRIPTION' | 'NOT_CONFIGURED'

export type PushSender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>

const defaultSender: PushSender = async (sub, payload) => {
  init()
  await webpush.sendNotification(sub, payload, { TTL: 3600 })
}

const MAX_ATTEMPTS = 3

/**
 * 사용자의 모든 구독으로 Push 전송.
 * - 23:00~07:00 KST 는 보내지 않는다(SKIPPED)
 * - 404/410 구독은 삭제
 * - 일시 오류는 제한적 재시도 후 NotifyLog FAILED
 * 반환: PushOutcome (한 곳이라도 성공하면 SENT)
 */
export async function sendToUser(userId: string, eventId: string | null, payload: PushPayload, opts: { now?: Date; sender?: PushSender } = {}): Promise<PushOutcome> {
  const now = opts.now ?? new Date()
  const sender = opts.sender ?? defaultSender
  if (isQuietHoursKst(now)) {
    await prisma.notifyLog.create({ data: { userId, eventId, status: 'SKIPPED', message: 'quiet hours' } })
    return 'QUIET'
  }
  if (!opts.sender && !pushConfigured()) {
    await prisma.notifyLog.create({ data: { userId, eventId, status: 'SKIPPED', message: 'push not configured' } })
    return 'NOT_CONFIGURED'
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) {
    await prisma.notifyLog.create({ data: { userId, eventId, status: 'SKIPPED', message: 'no subscription' } })
    return 'NO_SUBSCRIPTION'
  }
  let anySent = false
  for (const s of subs) {
    let lastErr = ''
    let ok = false
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !ok; attempt++) {
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
        ok = true
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        lastErr = `status=${status ?? 'n/a'}`
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined)
          break
        }
        if (status && status >= 400 && status < 500) break // 재시도 의미 없음
        await new Promise((r) => setTimeout(r, 200 * attempt))
      }
    }
    if (ok) {
      anySent = true
      await prisma.notifyLog.create({ data: { userId, eventId, status: 'SENT', message: payload.title.slice(0, 100) } })
    } else {
      logger.warn({ userId, err: lastErr }, 'push failed')
      await prisma.notifyLog.create({ data: { userId, eventId, status: 'FAILED', message: lastErr } })
    }
  }
  return anySent ? 'SENT' : 'FAILED'
}
