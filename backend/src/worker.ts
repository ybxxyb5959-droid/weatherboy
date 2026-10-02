// API 와 분리된 Worker 프로세스. 예약 작업만 담당한다.
import cron from 'node-cron'
import { prisma } from './db.js'
import { airQualityCollectionJob, weatherCollectionJob } from './jobs/collectionJobs.js'
import { eventForecastJob } from './jobs/eventForecastJob.js'
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
// 예보 수집 직후 점검 + 매시간 안전망. Push(판단 변경)도 이 안에서 처리된다.
const events = schedule('eventForecastJob', '25 * * * *', () => eventForecastJob())

logger.info('worker started')
void weather().then(() => air()).then(() => events())

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down')
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
