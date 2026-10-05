// API 와 분리된 Worker 프로세스. 예약 작업만 담당한다.
import cron from 'node-cron'
import { prisma } from './db.js'
import { airQualityCollectionJob, weatherCollectionJob } from './jobs/collectionJobs.js'
import { calendarSyncJob } from './jobs/calendarSyncJob.js'
import { dailyPushJob } from './jobs/dailyPushJob.js'
import { eventForecastJob } from './jobs/eventForecastJob.js'
import { guestCleanupJob } from './jobs/guestCleanupJob.js'
import { logger } from './utils/logger.js'

const running = new Set<string>()

function schedule(name: string, expr: string, fn: () => Promise<unknown>) {
  const run = async () => {
    if (running.has(name)) return // 겹침 방지
    running.add(name)
    const t0 = Date.now()
    try {
      const r = await fn()
      logger.info({ job: name, ms: Date.now() - t0, result: r }, 'job done')
    } catch (e) {
      logger.error({ job: name, err: e instanceof Error ? e.message : String(e) }, 'job failed')
    } finally {
      running.delete(name)
    }
  }
  cron.schedule(expr, () => void run(), { timezone: 'Asia/Seoul' })
  return run
}

// KMA 단기예보는 02,05,08,11,14,17,20,23시 발표(+10분 이후 조회 가능)
const weather = schedule('weatherCollectionJob', '15 2,5,8,11,14,17,20,23 * * *', () => weatherCollectionJob())
const air = schedule('airQualityCollectionJob', '20,50 * * * *', () => airQualityCollectionJob())
// 연동된 캘린더 자동 동기화(30분마다). 일정 점검(매시 25분) 전에 돌아서 바뀐 일정이 바로 반영된다.
const calendars = schedule('calendarSyncJob', '5,35 * * * *', () => calendarSyncJob())
// 예보 수집 직후 점검 + 매시간 안전망. Push(판단 변경)도 이 안에서 처리된다.
const events = schedule('eventForecastJob', '25 * * * *', () => eventForecastJob())

// 아침 옷차림 / 우산 / 귀가 후 후기 / 옷장 리마인드 등 종류별 알림 (15분마다 '지금 보낼 알림이 있는지' 판단, 같은 알림은 하루 한 번)
schedule('dailyPushJob', '*/15 * * * *', () => dailyPushJob())

// 오래 안 쓴 빈 게스트 계정 정리(하루 한 번, 새벽)
schedule('guestCleanupJob', '40 4 * * *', () => guestCleanupJob())

logger.info('worker started')
void weather().then(() => air()).then(() => calendars()).then(() => events())

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down')
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
