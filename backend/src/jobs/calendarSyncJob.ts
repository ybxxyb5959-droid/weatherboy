import { prisma } from '../db.js'
import { STALE_MS, syncConnection } from '../services/calendar/sync.js'
import { logger } from '../utils/logger.js'

const MAX_PER_RUN = 300

/**
 * 연결된 캘린더를 앱을 열지 않아도 주기적으로 다시 읽는다.
 * 읽어서 일정이 새로 생기거나 바뀌면 이어지는 일정 예보 점검(eventForecastJob)이 그 일정으로 추천·알림을 판단한다.
 * 한 연결이 실패해도 나머지는 계속한다(실패 이유는 연결에 기록된다).
 */
export async function calendarSyncJob(now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_MS + 60_000) // 30분 주기 실행이 1분 일찍 돌아도 대상이 되게
  const conns = await prisma.calendarConnection.findMany({
    where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }] },
    orderBy: { lastSyncedAt: { sort: 'asc', nulls: 'first' } },
    take: MAX_PER_RUN,
  })
  let ok = 0
  let failed = 0
  for (const c of conns) {
    try {
      await syncConnection(c, now)
      ok++
    } catch (e) {
      failed++
      logger.warn({ connection: c.id, err: e instanceof Error ? e.message : String(e) }, 'calendar sync failed')
    }
  }
  return { connections: conns.length, ok, failed }
}
