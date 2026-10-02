import webpush from 'web-push'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { isQuietNow } from '../../utils/time.js'
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
  /** 같은 tag 의 알림은 알림창에서 하나로 합쳐진다 (예: 아침 옷차림이 여러 번 쌓이지 않게) */
  tag?: string
}

/** 푸시 종류. NotifyLog.kind 에 그대로 기록된다. */
export type PushKind = 'EVENT_FIRST' | 'EVENT_CHANGE' | 'MORNING' | 'RAIN' | 'COLD_RETURN' | 'DUST' | 'FEEDBACK' | 'CLOSET' | 'NOTICE'

// DUPLICATE: 같은 dedupeKey 로 이미 보냈다(하루에 한 번만 보내는 알림)
export type PushOutcome = 'SENT' | 'FAILED' | 'QUIET' | 'NO_SUBSCRIPTION' | 'NOT_CONFIGURED' | 'DUPLICATE'

export type PushSender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>

const defaultSender: PushSender = async (sub, payload) => {
  init()
  await webpush.sendNotification(sub, payload, { TTL: 3600 })
}

const MAX_ATTEMPTS = 3

/**
 * 사용자의 모든 구독으로 Push 전송.
 * - 사용자가 정한 방해금지 시간(기본 23:00~07:00 KST)에는 보내지 않는다(SKIPPED)
 * - 404/410 구독은 삭제
 * - 일시 오류는 제한적 재시도 후 NotifyLog FAILED
 * 반환: PushOutcome (한 곳이라도 성공하면 SENT)
 */
export async function sendToUser(
  userId: string,
  eventId: string | null,
  payload: PushPayload,
  opts: { now?: Date; sender?: PushSender; kind?: PushKind; dedupeKey?: string } = {},
): Promise<PushOutcome> {
  const now = opts.now ?? new Date()
  const sender = opts.sender ?? defaultSender
  const kind = opts.kind ?? 'EVENT_FIRST'
  // 같은 키로 이미 보냈으면 다시 보내지 않는다(일정 알림이 아닌 하루 한 번짜리 알림용). 보류된(QUIET 등) 건은 키가 남지 않아 다시 시도된다.
  if (opts.dedupeKey && (await prisma.notifyLog.findFirst({ where: { userId, dedupeKey: opts.dedupeKey }, select: { id: true } }))) return 'DUPLICATE'
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { quietEnabled: true, quietStart: true, quietEnd: true } })
  if (u && isQuietNow(now, { enabled: u.quietEnabled, start: u.quietStart, end: u.quietEnd })) {
    await prisma.notifyLog.create({ data: { userId, eventId, kind, status: 'SKIPPED', message: 'quiet hours' } })
    return 'QUIET'
  }
  if (!opts.sender && !pushConfigured()) {
    await prisma.notifyLog.create({ data: { userId, eventId, kind, status: 'SKIPPED', message: 'push not configured' } })
    return 'NOT_CONFIGURED'
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) {
    await prisma.notifyLog.create({ data: { userId, eventId, kind, status: 'SKIPPED', message: 'no subscription' } })
    return 'NO_SUBSCRIPTION'
  }
  let anySent = false
  let keyUsed = false // dedupeKey 는 성공 기록 한 건에만 붙인다(유니크라서 구독이 여러 개여도 한 번만)
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
      await prisma.notifyLog.create({ data: { userId, eventId, kind, status: 'SENT', message: payload.title.slice(0, 100), dedupeKey: keyUsed ? null : (opts.dedupeKey ?? null) } })
      keyUsed = true
    } else {
      logger.warn({ userId, err: lastErr }, 'push failed')
      await prisma.notifyLog.create({ data: { userId, eventId, kind, status: 'FAILED', message: lastErr } })
    }
  }
  return anySent ? 'SENT' : 'FAILED'
}
