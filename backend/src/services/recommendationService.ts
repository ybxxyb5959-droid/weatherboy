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
  id: c.id, type: c.type, thickness: c.thickness, color: c.color, pattern: c.pattern, category: c.category, warmth: c.warmth, windproof: c.windproof, waterproof: c.waterproof, owned: !c.isSample, // 확인 전 예시 옷은 '내 옷'으로 추천하지 않는다 (일반 추천)
})

export type WindowSource = 'ROUTINE' | 'DEFAULT' | 'NOW'
export interface Routine { outAt: string | null; homeAt: string | null; days: number[] }

const DAY_MS = 24 * 3600_000
const weekdayOf = (kstYmd: string) => new Date(`${kstYmd}T00:00:00Z`).getUTCDay() // 0=일 ~ 6=토

/** 하루 패턴(외출/귀가/요일)으로 그 날의 외출 구간을 만든다. 패턴이 없거나 그 요일이 아니면 null. 귀가가 외출보다 이르거나 같으면 다음 날 귀가(야간)로 본다. */
function routineSpan(day: string, r: Routine | null): { start: Date; end: Date } | null {
  if (!r?.outAt || !r.homeAt || !r.days.includes(weekdayOf(day))) return null
  const start = fromKst(day, r.outAt)
  let end = fromKst(day, r.homeAt)
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + DAY_MS)
  return { start, end }
}

/**
 * 오늘의 외출 구간. 하루 패턴이 있으면 그 시간, 없으면 07:00~22:00(KST). 이미 지난 시간은 빼고(1시간 전부터),
 * 남은 구간이 3시간보다 짧으면 지금부터 3시간으로 본다. 어젯밤 외출이 새벽까지 이어지는 경우도 처리한다.
 */
export function todayWindow(now: Date, routine: Routine | null = null): { start: Date; end: Date; source: WindowSource } {
  const day = kstDate(now)
  const yesterday = kstDate(new Date(now.getTime() - DAY_MS))
  const prev = routineSpan(yesterday, routine)
  const today = routineSpan(day, routine)
  let nominal: { start: Date; end: Date }
  let source: WindowSource
  if (prev && prev.end.getTime() > now.getTime() && prev.start.getTime() < now.getTime()) {
    nominal = prev
    source = 'ROUTINE'
  } else if (today) {
    nominal = today
    source = 'ROUTINE'
  } else {
    nominal = { start: fromKst(day, TODAY_OUTING.start), end: fromKst(day, TODAY_OUTING.end) }
    source = 'DEFAULT'
  }
  const start = new Date(Math.max(nominal.start.getTime(), now.getTime() - 3600_000))
  if (nominal.end.getTime() - start.getTime() < 3 * 3600_000) {
    return { start: new Date(now.getTime() - 3600_000), end: new Date(now.getTime() + 3 * 3600_000), source: 'NOW' }
  }
  return { start, end: nominal.end, source }
}

export const routineOf = (u: Pick<User, 'routineOutAt' | 'routineHomeAt' | 'routineDays'>): Routine => ({ outAt: u.routineOutAt, homeAt: u.routineHomeAt, days: u.routineDays })

/** 추천이 어떤 시간·지역을 기준으로 계산됐는지. 화면에 그대로 보여준다. */
export interface RecommendationBasis {
  startAt: string
  endAt: string
  /** ROUTINE: 내 하루 패턴 / DEFAULT: 기본 07~22시 / NOW: 남은 시간이 짧아 지금부터 3시간 */
  source: WindowSource
  place: string | null
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
  /** 오늘 추천에서만 채운다(일정 추천은 일정 시간이 기준) */
  basis?: RecommendationBasis
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
  region: Region
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
  return { result, window, region }
}

/**
 * 화면에 보이는 추천 내용의 지문. decisionKey 는 Push 판단용이라 옷 "종류"만 보지만, 화면은 실제 옷(id·색·무늬)까지 같아야 재사용할 수 있다.
 * 옷 삭제/수정, 감도 변경으로 실제 조합이 바뀌면 지문이 달라져 새 버전이 만들어진다.
 */
export function outfitFingerprint(r: Pick<EngineResult, 'items' | 'needOuter' | 'needUmbrella' | 'needMask' | 'insufficientWardrobe'>): string {
  return JSON.stringify([
    r.items.map((i) => [i.clothingId, i.type, i.color, i.pattern, i.owned]),
    r.needOuter, r.needUmbrella, r.needMask, r.insufficientWardrobe,
  ])
}

/**
 * 저장된 최신 추천을 재사용할지 정한다. 조합이 같으면 같은 id(피드백 유지)를 쓰되 날씨 문구/수치는 최신으로 갱신하고,
 * 조합이 다르면 null 을 돌려줘 호출자가 새 버전을 만든다. 이전 버전은 피드백 기록으로 보존된다.
 */
async function refreshIfSameOutfit(latest: Recommendation | null, result: EngineResult, stage: string): Promise<Recommendation | null> {
  if (!latest) return null
  const old = latest.resultJson as unknown as EngineResult
  if (outfitFingerprint(old) !== outfitFingerprint(result)) return null
  const next = { ...result, forecastStage: stage }
  if (JSON.stringify(old) === JSON.stringify(next)) return latest
  return prisma.recommendation.update({
    where: { id: latest.id },
    data: { resultJson: next as unknown as Prisma.InputJsonValue, reasonCodes: result.reasonCodes, decisionKey: result.decisionKey },
  })
}

async function maybeExplain(result: EngineResult): Promise<string | null> {
  try {
    return await explain(result)
  } catch {
    return null
  }
}

/** 오늘 추천: 같은 날 같은 옷 조합이면 같은 Recommendation(id)을 재사용해 피드백이 안정적으로 붙게 한다. 조합이 바뀌면 새 버전. */
export async function todayRecommendation(user: User, now = new Date(), regionOverride?: Region): Promise<RecommendationView> {
  const { start, end, source } = todayWindow(now, routineOf(user))
  const c = await compute(user, null, start, end, now, regionOverride)
  if (!c) throw new AppError(502, 'WEATHER_UNAVAILABLE', '지금은 날씨 정보를 가져올 수 없어요.')
  // 다른 지역(즐겨찾기/검색)은 저장하지 않는다: 하루 1개 저장 추천은 내 기본 위치 기준이고, 피드백도 거기에만 붙는다.
  const placeOf = (r: Region) => [r.sido, r.district].filter(Boolean).join(' ') || null
  const basis: RecommendationBasis = { startAt: start.toISOString(), endAt: end.toISOString(), source, place: regionOverride ? placeOf(regionOverride) : (user.locationName ?? placeOf(c.region)) }
  if (regionOverride) return { ...viewFromResult({ ...c.result, forecastStage: c.window.stage }, { id: null, aiExplanation: null, version: 0, stage: c.window.stage }), basis }
  const dayStart = kstStartOfDay(now)
  const latest = await prisma.recommendation.findFirst({ where: { userId: user.id, eventId: null, targetStartAt: dayStart }, orderBy: { version: 'desc' } })
  const stage = c.window.stage
  const reused = await refreshIfSameOutfit(latest, c.result, stage)
  if (reused) return { ...viewOf(reused, stage), basis }
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
  return { ...viewOf(rec, stage), basis }
}

export function eventWindow(e: Pick<Event, 'startAt' | 'endAt'>) {
  return { start: e.startAt, end: e.endAt }
}

/** 일정 추천을 저장(판단이 바뀐 경우에만 새 버전)하고 Event 의 예보 단계/버전을 갱신한다. lastDecisionKey 는 Push 판단용이므로 여기서 건드리지 않는다. */
export async function saveEventRecommendation(event: Event, c: Computed): Promise<Recommendation> {
  const latest = await prisma.recommendation.findFirst({ where: { eventId: event.id }, orderBy: { version: 'desc' } })
  const stage = c.window.stage
  let saved = await refreshIfSameOutfit(latest, c.result, stage)
  if (!saved) {
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
