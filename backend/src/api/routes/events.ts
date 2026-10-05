import { Router } from 'express'
import { z } from 'zod'
import { eventKindMap } from '../../config/mappings.js'
import { prisma } from '../../db.js'
import { placeHintSchema, resolveLocation } from '../../services/location.js'
import { syncStaleInBackground } from '../../services/calendar/sync.js'
import { styleLabel } from '../../rules/outfitStyle.js'
import { activityByDay } from '../../rules/activityScore.js'
import { sunTimes } from '../../services/weather/sun.js'
import { gridToLatLng } from '../../utils/grid.js'
import { eventModeOf } from '../../rules/eventMode.js'
import { compute, dailyOutfits, outfitWanted, saveEventRecommendation, viewOf } from '../../services/recommendationService.js'
import { serializeEvent } from '../../services/serializers.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { fromKst, kstDate, kstTime, toKstParts } from '../../utils/time.js'
import type { OutingPoint } from '../../rules/outfitEngine.js'
import { getAirForecast } from '../../services/weather/weatherService.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'
import type { Event, Prisma } from '@prisma/client'

export const eventsRouter = Router()
eventsRouter.use(requireAuth)

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const idParam = z.string().uuid()
// 연박 돌려입기: 쿼리의 '1' 일 때만 켠다('0' 을 Boolean 으로 바꾸면 참이 되므로 직접 비교)
const flag = z.enum(['0', '1']).optional().transform((v) => v === '1')
const outfitQuery = z.object({ reuseTop: flag, reuseBottom: flag, examples: flag }).transform((q) => ({ top: q.reuseTop, bottom: q.reuseBottom, examples: q.examples }))
const MAX_EVENTS = 1000 // 한 사람이 만들 수 있는 일정 수의 상한

const createSchema = z.object({
  title: z.string().trim().min(1).max(100),
  startDate: date,
  endDate: date.optional(),
  startTime: time.default('09:00'),
  endTime: time.default('18:00'),
  place: z.string().trim().max(100).default(''),
  kind: z.enum(eventKindMap.uiValues),
  placeHint: placeHintSchema.optional(),
})
const updateSchema = createSchema.partial()

function buildTimes(startDate: string, endDate: string | undefined, startTime: string, endTime: string) {
  const startAt = fromKst(startDate, startTime)
  const endAt = fromKst(endDate ?? startDate, endTime)
  if (Number.isNaN(startAt.getTime()) || endAt.getTime() <= startAt.getTime()) throw badRequest('종료 시간이 시작보다 늦어야 해요.')
  return { startAt, endAt }
}

interface DaySlot {
  temp: number
  feels: number
  pop: number
}
interface DayWeather {
  date: string
  tempMin: number
  tempMax: number
  pop: number
  rain: boolean
  /** 그날을 대표하는 날씨 그림 종류(비/눈이 오면 그것, 아니면 낮의 하늘 상태) */
  condition: 'clear' | 'partly' | 'cloudy' | 'rain' | 'shower' | 'snow' | 'sleet'
  /** 시간별 예보가 있는 날만: 아침(6~11시)/낮(12~17시)/저녁(18시~) 평균. 일정 시간 밖은 포함하지 않는다. 중기예보 날짜는 null */
  slots: { morning: DaySlot | null; afternoon: DaySlot | null; evening: DaySlot | null } | null
}

/** 그날의 대표 날씨: 비/눈이 오는 시각이 있으면 가장 많은 종류, 없으면 낮(6~18시)의 가장 흔한 하늘 상태(없으면 강수확률로 짐작) */
export function conditionOfDay(pts: OutingPoint[]): DayWeather['condition'] {
  const wet = pts.filter((p) => p.precip !== 'none')
  if (wet.length > 0) {
    const count = new Map<string, number>()
    for (const p of wet) count.set(p.precip, (count.get(p.precip) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0] as DayWeather['condition']
  }
  const day = pts.filter((p) => { const h = toKstParts(p.at).hour; return h >= 6 && h < 18 })
  const skies = (day.length ? day : pts).map((p) => p.sky).filter((s): s is 'clear' | 'partly' | 'cloudy' => !!s)
  if (skies.length) {
    const count = new Map<string, number>()
    for (const s of skies) count.set(s, (count.get(s) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0] as DayWeather['condition']
  }
  const pop = Math.max(...pts.map((p) => p.pop))
  return pop >= 50 ? 'cloudy' : pop >= 20 ? 'partly' : 'clear'
}

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
const slotOf = (pts: OutingPoint[]): DaySlot | null => (pts.length ? { temp: avg(pts.map((p) => p.temp)), feels: avg(pts.map((p) => p.feels)), pop: Math.max(...pts.map((p) => p.pop)) } : null)

/** 일정 기간의 예보를 날짜별로 정리한다 (아침/낮/저녁 기온, 최저/최고, 강수확률) */
function weatherByDay(points: OutingPoint[]): DayWeather[] {
  const byDay = new Map<string, OutingPoint[]>()
  for (const p of points) {
    const d = kstDate(p.at)
    byDay.set(d, [...(byDay.get(d) ?? []), p])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pts]) => {
      // 중기예보 날짜는 정오 한 시각에 최저/최고 두 점만 있다 -> 시간대 구분 없음
      const hourly = new Set(pts.map((p) => p.at.getTime())).size > 1
      const hourOf = (p: OutingPoint) => toKstParts(p.at).hour
      return {
        date,
        tempMin: Math.round(Math.min(...pts.map((p) => p.temp))),
        tempMax: Math.round(Math.max(...pts.map((p) => p.temp))),
        pop: Math.max(...pts.map((p) => p.pop)),
        rain: pts.some((p) => p.precip !== 'none'),
        condition: conditionOfDay(pts),
        slots: hourly ? { morning: slotOf(pts.filter((p) => hourOf(p) >= 6 && hourOf(p) < 12)), afternoon: slotOf(pts.filter((p) => hourOf(p) >= 12 && hourOf(p) < 18)), evening: slotOf(pts.filter((p) => hourOf(p) >= 18 || hourOf(p) < 6)) } : null,
      }
    })
}

async function placeData(place: string, hint?: z.infer<typeof placeHintSchema>) {
  if (!place) return { placeName: '', latitude: null, longitude: null, gridNx: null, gridNy: null, regionSido: null, regionDistrict: null }
  const loc = await resolveLocation(place, hint)
  return {
    placeName: place,
    latitude: loc?.latitude ?? null,
    longitude: loc?.longitude ?? null,
    gridNx: loc?.gridNx ?? null,
    gridNy: loc?.gridNy ?? null,
    regionSido: loc?.regionSido ?? null,
    regionDistrict: loc?.regionDistrict ?? null,
  }
}

async function own(id: string, userId: string): Promise<Event> {
  const e = await prisma.event.findFirst({ where: { id, userId } })
  if (!e) throw notFound('일정을 찾을 수 없어요.')
  return e
}

eventsRouter.get(
  '/',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    syncStaleInBackground(userId) // 연결된 캘린더가 오래됐으면 뒤에서 새로 읽는다 (다음 조회부터 반영)
    const rows = await prisma.event.findMany({ where: { userId }, orderBy: { startAt: 'asc' } })
    res.json(rows.map(serializeEvent))
  }),
)

eventsRouter.post(
  '/',
  wrap(async (req, res) => {
    const b = parse(createSchema, req.body)
    const times = buildTimes(b.startDate, b.endDate, b.startTime, b.endTime)
    const userId = (req as AuthedRequest).userId
    if ((await prisma.event.count({ where: { userId } })) >= MAX_EVENTS) throw badRequest(`일정은 ${MAX_EVENTS}개까지 만들 수 있어요.`, 'LIMIT_REACHED')
    const row = await prisma.event.create({
      data: { userId, title: b.title, kind: eventKindMap.toDb(b.kind), ...times, ...(await placeData(b.place, b.placeHint)) },
    })
    res.status(201).json(serializeEvent(row))
  }),
)

eventsRouter.get(
  '/:id',
  wrap(async (req, res) => {
    res.json(serializeEvent(await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)))
  }),
)

eventsRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const cur = await own(parse(idParam, req.params.id), userId)
    const b = parse(updateSchema, req.body)
    const data: Prisma.EventUpdateInput = {}
    if (b.title !== undefined) data.title = b.title
    if (b.kind !== undefined) data.kind = eventKindMap.toDb(b.kind)
    const touchesTime = b.startDate !== undefined || b.endDate !== undefined || b.startTime !== undefined || b.endTime !== undefined
    if (touchesTime) {
      const sd = b.startDate ?? kstDate(cur.startAt)
      let ed = b.endDate ?? kstDate(cur.endAt)
      if (ed < sd) ed = sd
      const times = buildTimes(sd, ed, b.startTime ?? kstTime(cur.startAt), b.endTime ?? kstTime(cur.endAt))
      Object.assign(data, times)
    }
    if (b.place !== undefined) Object.assign(data, await placeData(b.place, b.placeHint))
    if (touchesTime || b.place !== undefined || b.kind !== undefined) {
      // 예보 조건이 바뀌면 예보 단계/추천 판단을 초기화하고 Worker 가 다시 점검한다.
      Object.assign(data, { forecastStage: 'WAITING', recommendationVersion: 0, lastDecisionKey: null, lastCheckedAt: null })
    }
    res.json(serializeEvent(await prisma.event.update({ where: { id: cur.id }, data })))
  }),
)

eventsRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const e = await own(parse(idParam, req.params.id), (req as AuthedRequest).userId)
    await prisma.event.delete({ where: { id: e.id } })
    res.status(204).end()
  }),
)

eventsRouter.get(
  '/:id/outfit',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const e = await own(parse(idParam, req.params.id), userId)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const waiting = (message: string) =>
      res.json({ status: 'waiting', forecastStage: 'WAITING', recommendation: null, message, weather: [], days: [], style: e.outfitStyle, styleLabel: e.outfitStyle ? styleLabel[e.outfitStyle] : null })
    const reuse = parse(outfitQuery, req.query)
    const c = await compute(user, e, e.startAt, e.endAt)
    if (!c) return waiting('아직 정확한 예보가 없어요.')
    // 옷차림을 안 보여주는 일정은 추천을 만들거나 저장하지 않는다: 활동(러닝·등산 등)은 야외활동 점수, 기타는 날씨만
    if (!outfitWanted(e)) {
      const grid = gridToLatLng(c.region.nx, c.region.ny)
      const base = { forecastStage: c.window.stage, recommendation: null, message: null, weather: weatherByDay(c.window.points), days: [], style: null, styleLabel: null }
      if (eventModeOf(e.kind, e.title) === 'activity') {
        return void res.json({ ...base, status: 'activity', activity: activityByDay(c.window.points, c.airGrade, kstDate(new Date()), (d) => sunTimes(d, grid.lat, grid.lng), await getAirForecast(c.region)) })
      }
      return void res.json({ ...base, status: 'weather_only' })
    }
    const saved = await saveEventRecommendation(e, c)
    const stage = c.window.stage
    res.json({ status: 'ready', forecastStage: stage, recommendation: viewOf(saved, stage), message: null, weather: weatherByDay(c.window.points), days: dailyOutfits(user, e, c, new Date(), reuse), reuse, style: e.outfitStyle, styleLabel: e.outfitStyle ? styleLabel[e.outfitStyle] : null, situationNotes: c.result.tabooReasons ?? [] })
  }),
)
