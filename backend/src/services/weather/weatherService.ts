// 예보 수집/캐시/조회. 같은 격자의 예보는 사용자와 무관하게 ForecastSnapshot 으로 공유한다.
import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.js'
import { feelsLike } from '../../rules/feelsLike.js'
import type { OutingPoint, PrecipType } from '../../rules/outfitEngine.js'
import { AirKoreaProvider } from '../airQuality/airkorea.js'
import { KmaWeatherProvider } from './kma.js'
import type { AirQualityProvider, AirQualityReading, DailyForecast, HourlyForecast, Nowcast, WeatherProvider } from './types.js'
import { fromKst, kstDate, toKstParts } from '../../utils/time.js'
import { logger } from '../../utils/logger.js'
import { AppError } from '../../utils/errors.js'
import type { ForecastStage } from '@prisma/client'

// 테스트에서 교체 가능
export const providers: { weather: WeatherProvider; air: AirQualityProvider } = {
  weather: new KmaWeatherProvider(),
  air: new AirKoreaProvider(),
}

const SHORT_TTL_MS = 30 * 60_000
const MID_TTL_MS = 3 * 3600_000
const AIR_TTL_MS = 30 * 60_000
const DAY = 86400_000

export interface Region {
  nx: number
  ny: number
  sido: string | null
  district: string | null
}

async function logCollect(job: string, target: string, status: 'SUCCESS' | 'FAILED' | 'PARTIAL', message: string | null, startedAt: number) {
  try {
    await prisma.collectLog.create({ data: { job, target, status, message: message?.slice(0, 500) ?? null, durationMs: Date.now() - startedAt } })
  } catch (e) {
    logger.warn({ err: String(e) }, 'collect log write failed')
  }
}

function precipOf(v: string | null): PrecipType {
  return v === 'rain' || v === 'snow' || v === 'sleet' || v === 'shower' ? v : 'none'
}

// ───── 단기예보(시간별) ─────
export interface ShortData {
  hourly: HourlyForecast[]
  dailyMin: Record<string, number>
  dailyMax: Record<string, number>
  issuedAt: Date
  stale: boolean
}

async function readShort(nx: number, ny: number): Promise<{ data: ShortData; fetchedAt: Date } | null> {
  const latest = await prisma.forecastSnapshot.findFirst({ where: { gridNx: nx, gridNy: ny, source: 'KMA_SHORT' }, orderBy: [{ issuedAt: 'desc' }, { fetchedAt: 'desc' }] })
  if (!latest) return null
  const rows = await prisma.forecastSnapshot.findMany({ where: { gridNx: nx, gridNy: ny, source: 'KMA_SHORT', issuedAt: latest.issuedAt }, orderBy: { targetAt: 'asc' } })
  const dailyMin: Record<string, number> = {}
  const dailyMax: Record<string, number> = {}
  const hourly: HourlyForecast[] = rows.map((r) => {
    const d = kstDate(r.targetAt)
    if (r.tempMin != null) dailyMin[d] = r.tempMin
    if (r.tempMax != null) dailyMax[d] = r.tempMax
    return {
      targetAt: r.targetAt,
      temp: r.temperature,
      pop: r.precipitationProbability ?? 0,
      precip: precipOf(r.precipitationType),
      wind: r.windSpeed ?? 0,
      humidity: r.humidity,
      sky: r.sky === 'clear' || r.sky === 'partly' || r.sky === 'cloudy' ? r.sky : null,
    }
  })
  return { data: { hourly, dailyMin, dailyMax, issuedAt: latest.issuedAt, stale: false }, fetchedAt: latest.fetchedAt }
}

export async function ensureShortTerm(nx: number, ny: number, now = new Date()): Promise<ShortData> {
  const cached = await readShort(nx, ny)
  if (cached && now.getTime() - cached.fetchedAt.getTime() < SHORT_TTL_MS) return cached.data
  const t0 = Date.now()
  try {
    const r = await providers.weather.fetchShortTerm(nx, ny, now)
    const minOf = (d: string) => r.dailyMin.get(d) ?? null
    const maxOf = (d: string) => r.dailyMax.get(d) ?? null
    const data: Prisma.ForecastSnapshotCreateManyInput[] = r.hourly.map((h) => ({
      gridNx: nx,
      gridNy: ny,
      source: 'KMA_SHORT',
      issuedAt: r.issuedAt,
      targetAt: h.targetAt,
      temperature: h.temp,
      tempMin: minOf(kstDate(h.targetAt)),
      tempMax: maxOf(kstDate(h.targetAt)),
      precipitationProbability: h.pop,
      precipitationType: h.precip,
      windSpeed: h.wind,
      humidity: h.humidity,
      sky: h.sky,
    }))
    await prisma.forecastSnapshot.createMany({ data, skipDuplicates: true })
    // 같은 발표시각을 다시 받은 경우 fetchedAt 갱신(캐시 TTL)
    await prisma.forecastSnapshot.updateMany({ where: { gridNx: nx, gridNy: ny, source: 'KMA_SHORT', issuedAt: r.issuedAt }, data: { fetchedAt: new Date() } })
    await logCollect('weather.short', `${nx},${ny}`, 'SUCCESS', `${data.length} rows`, t0)
    return (await readShort(nx, ny))!.data
  } catch (e) {
    await logCollect('weather.short', `${nx},${ny}`, 'FAILED', e instanceof Error ? e.message : String(e), t0)
    if (cached) return { ...cached.data, stale: true }
    throw e
  }
}

// ───── 초단기실황(지금 관측값) ─────
// 관측은 매시 한 번이라 10분만 기억해도 충분하다. 격자마다 프로세스 메모리에 둔다(지금 화면에만 쓰고 저장하지 않는다).
const NOWCAST_TTL_MS = 10 * 60_000
const nowcastCache = new Map<string, { at: number; value: Nowcast | null }>()
const nowcastInFlight = new Map<string, Promise<Nowcast | null>>()

/** 지금 관측값. 실패하거나 지원하지 않으면 null (화면은 단기예보 값으로 보여준다) */
export async function getNowcast(nx: number, ny: number, now = new Date()): Promise<Nowcast | null> {
  const fetchNowcast = providers.weather.fetchNowcast?.bind(providers.weather)
  if (!fetchNowcast || !providers.weather.configured) return null
  const key = `${nx},${ny}`
  const hit = nowcastCache.get(key)
  if (hit && now.getTime() - hit.at < NOWCAST_TTL_MS) return hit.value
  const pending = nowcastInFlight.get(key)
  if (pending) return pending
  const p = (async () => {
    try {
      const value = await fetchNowcast(nx, ny, now)
      nowcastCache.set(key, { at: now.getTime(), value })
      return value
    } catch (e) {
      logger.warn({ err: e instanceof Error ? e.message : String(e), grid: key }, 'nowcast failed')
      // 실패해도 직전 값이 1시간 안이면 그걸 쓴다
      return hit && now.getTime() - hit.at < 3600_000 ? hit.value : null
    } finally {
      nowcastInFlight.delete(key)
    }
  })()
  nowcastInFlight.set(key, p)
  return p
}

// ───── 중기예보(일별) ─────
async function readMid(nx: number, ny: number): Promise<{ daily: DailyForecast[]; fetchedAt: Date } | null> {
  const latest = await prisma.forecastSnapshot.findFirst({ where: { gridNx: nx, gridNy: ny, source: 'KMA_MID' }, orderBy: [{ issuedAt: 'desc' }, { fetchedAt: 'desc' }] })
  if (!latest) return null
  const rows = await prisma.forecastSnapshot.findMany({ where: { gridNx: nx, gridNy: ny, source: 'KMA_MID', issuedAt: latest.issuedAt }, orderBy: { targetAt: 'asc' } })
  return {
    fetchedAt: latest.fetchedAt,
    daily: rows.map((r) => ({
      date: kstDate(r.targetAt),
      tempMin: r.tempMin ?? r.temperature,
      tempMax: r.tempMax ?? r.temperature,
      pop: r.precipitationProbability ?? 0,
      precip: precipOf(r.precipitationType),
      skyText: r.sky,
    })),
  }
}

export async function ensureMidTerm(region: Region, now = new Date()): Promise<DailyForecast[]> {
  const cached = await readMid(region.nx, region.ny)
  if (cached && now.getTime() - cached.fetchedAt.getTime() < MID_TTL_MS) return cached.daily
  if (!region.sido) return cached?.daily ?? []
  const t0 = Date.now()
  try {
    const r = await providers.weather.fetchMidTerm(region.sido, region.district, now)
    const data: Prisma.ForecastSnapshotCreateManyInput[] = r.daily.map((d) => ({
      gridNx: region.nx,
      gridNy: region.ny,
      source: 'KMA_MID',
      issuedAt: r.issuedAt,
      targetAt: fromKst(d.date, '12:00'),
      temperature: (d.tempMin + d.tempMax) / 2,
      tempMin: d.tempMin,
      tempMax: d.tempMax,
      precipitationProbability: d.pop,
      precipitationType: d.precip,
      sky: d.skyText,
    }))
    await prisma.forecastSnapshot.createMany({ data, skipDuplicates: true })
    await prisma.forecastSnapshot.updateMany({ where: { gridNx: region.nx, gridNy: region.ny, source: 'KMA_MID', issuedAt: r.issuedAt }, data: { fetchedAt: new Date() } })
    await logCollect('weather.mid', `${region.sido}/${region.nx},${region.ny}`, 'SUCCESS', `${data.length} rows`, t0)
    return (await readMid(region.nx, region.ny))?.daily ?? []
  } catch (e) {
    await logCollect('weather.mid', `${region.sido}/${region.nx},${region.ny}`, 'FAILED', e instanceof Error ? e.message : String(e), t0)
    return cached?.daily ?? []
  }
}

// ───── 대기질 ─────
const AIR_STALE_OK_MS = 3 * 3600_000 // 새로 못 받아오면 이 시간 안의 마지막 값은 그대로 보여준다
const airInFlight = new Map<string, Promise<AirQualityReading | null>>()

const toReading = (key: string, r: { stationName: string | null; pm10: number | null; pm25: number | null; pm10Grade: number | null; pm25Grade: number | null }): AirQualityReading => ({
  region: key, stationName: r.stationName, pm10: r.pm10, pm25: r.pm25, pm10Grade: r.pm10Grade, pm25Grade: r.pm25Grade,
})

/**
 * 시도+구 단위 캐시(30분). 같은 지역을 동시에 여러 곳(날씨 화면/추천/수집)에서 물어도 외부 호출은 한 번만 나간다.
 * 측정소 이름이 구 이름과 달라도 캐시가 맞도록 캐시 키는 요청한 지역(시도|구)으로 정한다.
 */
export async function getAirQuality(region: Region, now = new Date()): Promise<AirQualityReading | null> {
  if (!region.sido) return null
  const key = `${region.sido}|${region.district ?? ''}`
  const fresh = await prisma.airQuality.findFirst({ where: { region: key, fetchedAt: { gt: new Date(now.getTime() - AIR_TTL_MS) } }, orderBy: { fetchedAt: 'desc' } })
  if (fresh) return toReading(key, fresh)
  if (!providers.air.configured) return null
  const pending = airInFlight.get(key)
  if (pending) return pending
  const p = fetchAir(region, key, now).finally(() => airInFlight.delete(key))
  airInFlight.set(key, p)
  return p
}

async function fetchAir(region: Region, key: string, now: Date): Promise<AirQualityReading | null> {
  const t0 = Date.now()
  try {
    const r = await providers.air.fetch(region.sido as string, region.district)
    await prisma.airQuality.create({ data: { region: key, stationName: r.stationName ?? region.district ?? null, pm10: r.pm10, pm25: r.pm25, pm10Grade: r.pm10Grade, pm25Grade: r.pm25Grade } })
    await logCollect('air', key, 'SUCCESS', null, t0)
    return { ...r, region: key }
  } catch (e) {
    // AirKorea 실패가 날씨 전체 실패로 이어지지 않는다 (Partial Failure). 최근 값이 있으면 그걸 쓴다.
    await logCollect('air', key, 'PARTIAL', e instanceof Error ? e.message : String(e), t0)
    const last = await prisma.airQuality.findFirst({ where: { region: key, fetchedAt: { gt: new Date(now.getTime() - AIR_STALE_OK_MS) } }, orderBy: { fetchedAt: 'desc' } })
    return last ? toReading(key, last) : null
  }
}

// ───── 외출 구간 예보 ─────
export interface WindowForecast {
  stage: ForecastStage
  points: OutingPoint[]
  feelsMethod: string
  tempMin: number | null
  tempMax: number | null
  stale: boolean
  usedMid: boolean
  /** 단기예보 발표 시각(없으면 null) */
  issuedAt: Date | null
  /** 외출 구간 안에서 시간별 예보가 있는 시각 수 / 구간이 기대하는 시각 수 */
  shortCount: number
  expectedCount: number
}

/** 중기예보 문구(맑음/구름많음/흐림) -> 하늘 상태 */
export function skyOfText(t: string | null): 'clear' | 'partly' | 'cloudy' | null {
  if (!t) return null
  if (t.includes('맑')) return 'clear'
  if (t.includes('구름')) return 'partly'
  if (t.includes('흐')) return 'cloudy'
  return null
}

export function toOutingPoint(h: HourlyForecast): { point: OutingPoint; method: string } {
  const f = feelsLike({ tempC: h.temp, windMs: h.wind, humidity: h.humidity, month: toKstParts(h.targetAt).month })
  return { point: { at: h.targetAt, temp: h.temp, feels: f.feels, pop: h.pop, precip: h.precip, wind: h.wind, sky: h.sky }, method: f.method }
}

/**
 * [start, end] 외출 구간의 예보를 모은다.
 * 단기예보(시간별)로 커버되는 시간은 시간별 데이터, 그 밖의 날짜는 중기예보(일별 최저/최고)를 쓴다.
 * 실제 데이터가 하나도 없으면 stage=WAITING (없는 예보를 만들지 않는다).
 */
export async function forecastForWindow(region: Region, start: Date, end: Date, now = new Date()): Promise<WindowForecast> {
  let hourly: HourlyForecast[] = []
  let stale = false
  let issuedAt: Date | null = null
  const out: WindowForecast = { stage: 'WAITING', points: [], feelsMethod: 'FALLBACK_TEMP', tempMin: null, tempMax: null, stale: false, usedMid: false, issuedAt: null, shortCount: 0, expectedCount: 0 }
  if (end.getTime() < now.getTime() - 3600_000) return out

  if (start.getTime() - now.getTime() < 4 * DAY) {
    try {
      const s = await ensureShortTerm(region.nx, region.ny, now)
      hourly = s.hourly
      stale = s.stale
      issuedAt = s.issuedAt
    } catch (e) {
      if (!(e instanceof AppError)) throw e
      if (e.code === 'WEATHER_NOT_CONFIGURED') throw e
    }
  }
  const lo = start.getTime() - 59 * 60_000
  const inWin = hourly.filter((h) => h.targetAt.getTime() >= lo && h.targetAt.getTime() <= end.getTime())
  const methods: string[] = []
  for (const h of inWin) {
    const { point, method } = toOutingPoint(h)
    out.points.push(point)
    methods.push(method)
  }
  const shortDays = new Set(inWin.map((h) => kstDate(h.targetAt)))
  if (inWin.length > 0) out.stage = 'SHORTTERM'
  out.issuedAt = issuedAt
  out.shortCount = inWin.length
  // 이미 지난 시간은 예보가 없어도 부족한 게 아니므로, 지금부터 끝까지만 센다
  out.expectedCount = Math.max(1, Math.floor((end.getTime() - Math.max(start.getTime(), now.getTime() - 3600_000)) / 3600_000) + 1)

  // 단기예보가 덮지 못한 날짜 -> 중기예보
  const days: string[] = []
  for (let t = fromKst(kstDate(start), '00:00').getTime(); t <= end.getTime(); t += DAY) days.push(kstDate(new Date(t + 12 * 3600_000)))
  const missing = days.filter((d) => !shortDays.has(d))
  if (missing.length > 0 && end.getTime() - now.getTime() < 11 * DAY && end.getTime() > now.getTime() + 2 * DAY) {
    const daily = await ensureMidTerm(region, now)
    for (const d of daily) {
      if (!missing.includes(d.date)) continue
      const at = fromKst(d.date, '12:00')
      const sky = skyOfText(d.skyText)
      out.points.push({ at, temp: d.tempMin, feels: d.tempMin, pop: d.pop, precip: d.precip, wind: 0, sky })
      out.points.push({ at, temp: d.tempMax, feels: d.tempMax, pop: d.pop, precip: d.precip, wind: 0, sky })
      out.usedMid = true
      if (out.stage === 'WAITING') out.stage = 'MIDTERM'
    }
  }
  out.points.sort((a, b) => a.at.getTime() - b.at.getTime())
  if (methods.length) out.feelsMethod = methods.every((m) => m === 'FALLBACK_TEMP') ? 'FALLBACK_TEMP' : methods.find((m) => m !== 'FALLBACK_TEMP')!
  if (out.points.length) {
    out.tempMin = Math.min(...out.points.map((p) => p.temp))
    out.tempMax = Math.max(...out.points.map((p) => p.temp))
  }
  out.stale = stale
  return out
}
