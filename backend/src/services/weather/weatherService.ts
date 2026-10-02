// 예보 수집/캐시/조회. 같은 격자의 예보는 사용자와 무관하게 ForecastSnapshot 으로 공유한다.
import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.js'
import { feelsLike } from '../../rules/feelsLike.js'
import type { OutingPoint, PrecipType } from '../../rules/outfitEngine.js'
import { AirKoreaProvider } from '../airQuality/airkorea.js'
import { KmaWeatherProvider } from './kma.js'
import type { AirQualityProvider, AirQualityReading, DailyForecast, HourlyForecast, WeatherProvider } from './types.js'
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
export async function getAirQuality(region: Region, now = new Date()): Promise<AirQualityReading | null> {
  if (!region.sido) return null
  const key = region.sido
  const recent = await prisma.airQuality.findFirst({ where: { region: key, fetchedAt: { gt: new Date(now.getTime() - AIR_TTL_MS) } }, orderBy: { fetchedAt: 'desc' } })
  if (recent && recent.stationName === (region.district ?? null)) {
    return { region: key, stationName: recent.stationName, pm10: recent.pm10, pm25: recent.pm25, pm10Grade: recent.pm10Grade, pm25Grade: recent.pm25Grade }
  }
  if (!providers.air.configured) return null
  const t0 = Date.now()
  try {
    const r = await providers.air.fetch(region.sido, region.district)
    await prisma.airQuality.create({ data: { region: key, stationName: r.stationName ?? region.district ?? null, pm10: r.pm10, pm25: r.pm25, pm10Grade: r.pm10Grade, pm25Grade: r.pm25Grade } })
    await logCollect('air', key, 'SUCCESS', null, t0)
    return r
  } catch (e) {
    // AirKorea 실패가 날씨 전체 실패로 이어지지 않는다 (Partial Failure)
    await logCollect('air', key, 'PARTIAL', e instanceof Error ? e.message : String(e), t0)
    return null
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
}

export function toOutingPoint(h: HourlyForecast): { point: OutingPoint; method: string } {
  const f = feelsLike({ tempC: h.temp, windMs: h.wind, humidity: h.humidity, month: toKstParts(h.targetAt).month })
  return { point: { at: h.targetAt, temp: h.temp, feels: f.feels, pop: h.pop, precip: h.precip, wind: h.wind }, method: f.method }
}

/**
 * [start, end] 외출 구간의 예보를 모은다.
 * 단기예보(시간별)로 커버되는 시간은 시간별 데이터, 그 밖의 날짜는 중기예보(일별 최저/최고)를 쓴다.
 * 실제 데이터가 하나도 없으면 stage=WAITING (없는 예보를 만들지 않는다).
 */
export async function forecastForWindow(region: Region, start: Date, end: Date, now = new Date()): Promise<WindowForecast> {
  let hourly: HourlyForecast[] = []
  let stale = false
  const out: WindowForecast = { stage: 'WAITING', points: [], feelsMethod: 'FALLBACK_TEMP', tempMin: null, tempMax: null, stale: false, usedMid: false }
  if (end.getTime() < now.getTime() - 3600_000) return out

  if (start.getTime() - now.getTime() < 4 * DAY) {
    try {
      const s = await ensureShortTerm(region.nx, region.ny, now)
      hourly = s.hourly
      stale = s.stale
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

  // 단기예보가 덮지 못한 날짜 -> 중기예보
  const days: string[] = []
  for (let t = fromKst(kstDate(start), '00:00').getTime(); t <= end.getTime(); t += DAY) days.push(kstDate(new Date(t + 12 * 3600_000)))
  const missing = days.filter((d) => !shortDays.has(d))
  if (missing.length > 0 && end.getTime() - now.getTime() < 11 * DAY && end.getTime() > now.getTime() + 2 * DAY) {
    const daily = await ensureMidTerm(region, now)
    for (const d of daily) {
      if (!missing.includes(d.date)) continue
      const at = fromKst(d.date, '12:00')
      out.points.push({ at, temp: d.tempMin, feels: d.tempMin, pop: d.pop, precip: d.precip, wind: 0 })
      out.points.push({ at, temp: d.tempMax, feels: d.tempMax, pop: d.pop, precip: d.precip, wind: 0 })
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
