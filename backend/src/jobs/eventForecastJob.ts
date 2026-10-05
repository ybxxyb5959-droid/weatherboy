import { notifyConfig } from '../config/ruleConfig.js'
import { prisma } from '../db.js'
import { compute, outfitWanted, saveEventRecommendation } from '../services/recommendationService.js'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import type { PushSender } from '../services/push/push.js'
import { pushNotificationJob } from './pushNotificationJob.js'

/**
 * 다가오는 일정을 점검한다. D-10/D-3/D-1 은 UI 상의 안내 시점일 뿐이고,
 * 단계(WAITING/MIDTERM/SHORTTERM)는 "실제로 예보 데이터가 존재하는지"로만 결정한다.
 */
export async function eventForecastJob(now = new Date(), sender?: PushSender) {
  const until = new Date(now.getTime() + notifyConfig.eventLookaheadDays * 86400_000)
  // 옷 추천을 보여주는 일정만 점검한다(활동·기타는 추천을 저장하거나 알리지 않는다)
  const events = (await prisma.event.findMany({ where: { endAt: { gt: now }, startAt: { lt: until } }, include: { user: true }, orderBy: { startAt: 'asc' } })).filter(outfitWanted)
  let processed = 0
  let failed = 0
  let skipped = 0
  for (const ev of events) {
    const t0 = Date.now()
    try {
      const { user, ...event } = ev
      const c = await compute(user, event, event.startAt, event.endAt, now)
      if (!c) {
        await prisma.event.update({ where: { id: event.id }, data: { lastCheckedAt: now } })
      } else {
        await saveEventRecommendation(event, c)
        const fresh = await prisma.event.findUniqueOrThrow({ where: { id: event.id } })
        await pushNotificationJob(user, fresh, c.result.decisionKey, { now, sender })
      }
      processed++
    } catch (e) {
      // 위치를 아직 정하지 않은 사용자(온보딩 전)는 오류가 아니라 정상 상태 -> 건너뛴다
      if (e instanceof AppError && e.code === 'LOCATION_UNRESOLVED') {
        skipped++
        await prisma.event.update({ where: { id: ev.id }, data: { lastCheckedAt: now } }).catch(() => undefined)
        continue
      }
      failed++
      logger.warn({ eventId: ev.id, err: e instanceof Error ? e.message : String(e) }, 'event forecast failed')
      await prisma.collectLog.create({ data: { job: 'eventForecast', target: ev.id, status: 'FAILED', message: (e instanceof Error ? e.message : String(e)).slice(0, 300), durationMs: Date.now() - t0 } }).catch(() => undefined)
    }
  }
  return { processed, skipped, failed }
}
