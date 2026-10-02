import type { Clothing, Event, Prisma, Recommendation, User } from '@prisma/client'
import { prisma } from '../db.js'
import { recommend, type EngineResult, type OutingPoint, type WardrobeItem } from '../rules/outfitEngine.js'
import { AppError } from '../utils/errors.js'
import { fromKst, kstDate, kstStartOfDay } from '../utils/time.js'
import { explain } from './ai/explain.js'
import { forecastForWindow, getAirQuality, type Region, type WindowForecast } from './weather/weatherService.js'

export const TODAY_OUTING = { start: '07:00', end: '22:00' }

export function regionOf(u: Pick<User, 'gridNx' | 'gridNy' | 'regionSido' | 'regionDistrict'>, e?: Pick<Event, 'gridNx' | 'gridNy' | 'regionSido' | 'regionDistrict'> | null): Region | null {
  const src = e && e.gridNx != null && e.gridNy != null ? e : u
  if (src.gridNx == null || src.gridNy == null) return null
  return { nx: src.gridNx, ny: src.gridNy, sido: src.regionSido, district: src.regionDistrict }
}

export const toWardrobe = (c: Clothing): WardrobeItem => ({
  id: c.id, type: c.type, thickness: c.thickness, color: c.color, pattern: c.pattern, category: c.category, warmth: c.warmth, windproof: c.windproof, waterproof: c.waterproof, owned: true,
})

/** 오늘의 외출 구간: 07:00~22:00(KST) 중 현재 이후. 이미 늦었다면 지금부터 3시간. */
export function todayWindow(now: Date): { start: Date; end: Date } {
  const day = kstDate(now)
  const end = fromKst(day, TODAY_OUTING.end)
  const startNominal = fromKst(day, TODAY_OUTING.start)
  let start = new Date(Math.max(startNominal.getTime(), now.getTime() - 3600_000))
  if (end.getTime() - start.getTime() < 3 * 3600_000) {
    start = new Date(now.getTime() - 3600_000)
    return { start, end: new Date(now.getTime() + 3 * 3600_000) }
  }
  return { start, end }
}

export interface RecommendationView {
  /** 저장된 추천의 id. 즐겨찾기/검색한 다른 지역 추천은 저장하지 않아 null (피드백 불가) */
  id: string | null
  items: EngineResult['items']
  needOuter: boolean
  needUmbrella: boolean
  needMask: boolean
  maskDataAvailable: boolean
  headline: string
  sub: string
  reasons: string[]
  alternatives: EngineResult['alternatives']
  insufficientWardrobe: boolean
  aiExplanation: string | null
  forecastStage: string
  version: number
}

export function viewOf(rec: Recommendation, stage?: string): RecommendationView {
  const r = rec.resultJson as unknown as EngineResult & { forecastStage?: string }
  return viewFromResult(r, { id: rec.id, aiExplanation: rec.aiExplanation, version: rec.version, stage })
}

export function viewFromResult(r: EngineResult & { forecastStage?: string }, o: { id: string | null; aiExplanation: string | null; version: number; stage?: string }): RecommendationView {
  return {
    id: o.id,
    items: r.items,
    needOuter: r.needOuter,
    needUmbrella: r.needUmbrella,
    needMask: r.needMask,
    maskDataAvailable: r.maskDataAvailable,
    headline: r.headline,
    sub: r.sub,
    reasons: r.reasons,
    alternatives: r.alternatives,
    insufficientWardrobe: r.insufficientWardrobe,
    aiExplanation: o.aiExplanation,
    forecastStage: o.stage ?? r.forecastStage ?? 'SHORTTERM',
    version: o.version,
  }
}

export interface Computed {
  result: EngineResult
  window: WindowForecast
}

/** 순수 계산: 예보 + 옷장 -> 엔진 결과 (저장하지 않음) */
export async function compute(user: User, event: Event | null, start: Date, end: Date, now = new Date(), regionOverride?: Region): Promise<Computed | null> {
  const region = regionOverride ?? regionOf(user, event)
  if (!region) throw new AppError(409, 'LOCATION_UNRESOLVED', '위치를 확인하지 못했어요. 설정에서 위치를 다시 선택해주세요.')
  const window = await forecastForWindow(region, start, end, now)
  if (window.points.length === 0) return null
  const [clothes, air] = await Promise.all([prisma.clothing.findMany({ where: { userId: user.id, active: true }, orderBy: { id: 'asc' } }), getAirQuality(region, now)])
  const grade = air ? Math.max(air.pm10Grade ?? 0, air.pm25Grade ?? 0) || null : null
  const points: OutingPoint[] = window.points
  const result = recommend({
    points,
    sensitivity: user.sensitivity,
    feedbackOffset: user.feedbackOffset,
    eventKind: event?.kind ?? null,
    clothes: clothes.map(toWardrobe),
    airGrade: grade,
    feelsMethod: window.feelsMethod,
  })
  if (window.usedMid) result.reasonCodes.push('MIDTERM_APPROX')
  return { result, window }
}

async function maybeExplain(result: EngineResult): Promise<string | null> {
  try {
    return await explain(result)
  } catch {
    return null
  }
}

/** 오늘 추천: 같은 날 같은 판단이면 같은 Recommendation(id)을 재사용해 피드백이 안정적으로 붙게 한다. */
export async function todayRecommendation(user: User, now = new Date(), regionOverride?: Region): Promise<RecommendationView> {
  const { start, end } = todayWindow(now)
  const c = await compute(user, null, start, end, now, regionOverride)
  if (!c) throw new AppError(502, 'WEATHER_UNAVAILABLE', '지금은 날씨 정보를 가져올 수 없어요.')
  // 다른 지역(즐겨찾기/검색)은 저장하지 않는다: 하루 1개 저장 추천은 내 기본 위치 기준이고, 피드백도 거기에만 붙는다.
  if (regionOverride) return viewFromResult({ ...c.result, forecastStage: c.window.stage }, { id: null, aiExplanation: null, version: 0, stage: c.window.stage })
  const dayStart = kstStartOfDay(now)
  const latest = await prisma.recommendation.findFirst({ where: { userId: user.id, eventId: null, targetStartAt: dayStart }, orderBy: { version: 'desc' } })
  const stage = c.window.stage
  if (latest && latest.decisionKey === c.result.decisionKey) return viewOf(latest, stage)
  const aiExplanation = await maybeExplain(c.result)
  const rec = await prisma.recommendation.create({
    data: {
      userId: user.id,
      targetStartAt: dayStart,
      targetEndAt: end,
      resultJson: { ...c.result, forecastStage: stage } as unknown as Prisma.InputJsonValue,
      reasonCodes: c.result.reasonCodes,
      decisionKey: c.result.decisionKey,
      version: (latest?.version ?? 0) + 1,
      aiExplanation,
    },
  })
  return viewOf(rec, stage)
}

export function eventWindow(e: Pick<Event, 'startAt' | 'endAt'>) {
  return { start: e.startAt, end: e.endAt }
}

/** 일정 추천을 저장(판단이 바뀐 경우에만 새 버전)하고 Event 의 예보 단계/버전을 갱신한다. lastDecisionKey 는 Push 판단용이므로 여기서 건드리지 않는다. */
export async function saveEventRecommendation(event: Event, c: Computed): Promise<Recommendation> {
  const latest = await prisma.recommendation.findFirst({ where: { eventId: event.id }, orderBy: { version: 'desc' } })
  const stage = c.window.stage
  let saved = latest
  if (!latest || latest.decisionKey !== c.result.decisionKey) {
    saved = await prisma.recommendation.create({
      data: {
        userId: event.userId,
        eventId: event.id,
        targetStartAt: event.startAt,
        targetEndAt: event.endAt,
        resultJson: { ...c.result, forecastStage: stage } as unknown as Prisma.InputJsonValue,
        reasonCodes: c.result.reasonCodes,
        decisionKey: c.result.decisionKey,
        version: (latest?.version ?? 0) + 1,
        aiExplanation: await maybeExplain(c.result),
      },
    })
  }
  await prisma.event.update({ where: { id: event.id }, data: { forecastStage: stage, recommendationVersion: saved!.version, lastCheckedAt: new Date() } })
  return saved!
}
