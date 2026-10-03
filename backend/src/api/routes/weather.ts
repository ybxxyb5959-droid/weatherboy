import { Router } from 'express'
import { dustGradeLabel, windLabel } from '../../config/ruleConfig.js'
import { prisma } from '../../db.js'
import { feelsLike } from '../../rules/feelsLike.js'
import { regionOf, todayRecommendation } from '../../services/recommendationService.js'
import { resolveTarget } from '../../services/placeTarget.js'
import { deriveCondition } from '../../services/weather/conditions.js'
import { ensureMidTerm, ensureShortTerm, getAirQuality, getNowcast } from '../../services/weather/weatherService.js'
import { AppError } from '../../utils/errors.js'
import { kstDate, toKstParts } from '../../utils/time.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'
import { feedbackMap } from '../../config/mappings.js'
import { ruleConfig } from '../../config/ruleConfig.js'
import { z } from 'zod'
import { notFound } from '../../utils/errors.js'

// 중기예보 문구(맑음/구름많음/흐림 ...) -> 낙서 종류
function skyKindFromText(t: string | null): string {
  if (!t) return 'cloudy'
  if (t.includes('맑')) return 'clear'
  if (t.includes('구름')) return 'partly'
  return 'cloudy'
}

export const weatherRouter = Router()
export const recommendationsRouter = Router()

weatherRouter.get(
  '/today',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: (req as AuthedRequest).userId } })
    // ?favoriteId= / ?place= 로 다른 지역을 볼 수 있다. 없으면 내 기본 위치.
    const target = await resolveTarget(user.id, req.query)
    const region = target?.region ?? regionOf(user)
    if (!region) throw new AppError(409, 'LOCATION_UNRESOLVED', '위치를 확인하지 못했어요. 설정에서 위치를 다시 선택해주세요.')
    const now = new Date()
    const [short, nowcast] = await Promise.all([ensureShortTerm(region.nx, region.ny, now), getNowcast(region.nx, region.ny, now)])
    // 현재 시각 이전(포함)의 가장 가까운 시간별 예보, 없으면 첫 예보
    const past = short.hourly.filter((h) => h.targetAt.getTime() <= now.getTime())
    const forecastNow = past[past.length - 1] ?? short.hourly[0]
    if (!forecastNow) throw new AppError(502, 'WEATHER_UNAVAILABLE', '지금은 날씨 정보를 가져올 수 없어요.')
    // 지금 기온·습도·바람·비는 실제 관측(초단기실황)이 있으면 그 값을 쓴다. 단기예보는 3시간마다 낸 예측이라 지금과 몇 도씩 다를 수 있다.
    const current = nowcast
      ? {
          ...forecastNow,
          temp: nowcast.temp ?? forecastNow.temp,
          humidity: nowcast.humidity ?? forecastNow.humidity,
          wind: nowcast.wind ?? forecastNow.wind,
          precip: nowcast.precip !== 'none' ? nowcast.precip : forecastNow.precip === 'none' || (nowcast.rain1h ?? 0) > 0 ? forecastNow.precip : 'none',
        }
      : forecastNow
    const f = feelsLike({ tempC: current.temp, windMs: current.wind, humidity: current.humidity, month: toKstParts(now).month })
    const air = await getAirQuality(region, now)
    const dustGrade = air ? Math.max(air.pm10Grade ?? 0, air.pm25Grade ?? 0) || null : null
    const today = kstDate(now)
    const tempMin = short.dailyMin[today] ?? null
    const tempMax = short.dailyMax[today] ?? null
    const { condition, flags } = deriveCondition({ now, current, feels: f.feels, tempMin, tempMax, dustGrade })
    // 시간대별 예보: 3시간 간격(0,3,6..시)으로 앞으로 8칸(약 24시간)
    const hourly = short.hourly
      .filter((h) => h.targetAt.getTime() >= now.getTime() - 60 * 60 * 1000 && toKstParts(h.targetAt).hour % 3 === 0)
      .slice(0, 8)
      .map((h) => {
        const hour = toKstParts(h.targetAt).hour
        const night = hour >= 20 || hour < 5
        const kind =
          h.precip !== 'none' ? h.precip : h.sky === 'clear' ? (night ? 'night' : 'clear') : (h.sky ?? 'cloudy')
        return { time: h.targetAt.toISOString(), hour, temp: Math.round(h.temp), pop: h.pop, condition: kind }
      })
    // 앞으로 며칠: 단기예보로 채울 수 있는 날은 시간별 데이터로, 그 뒤는 중기예보로 이어 붙인다
    const byDate = new Map<string, typeof short.hourly>()
    for (const h of short.hourly) {
      const d = kstDate(h.targetAt)
      if (d <= today) continue
      byDate.set(d, [...(byDate.get(d) ?? []), h])
    }
    const daily: { date: string; tempMin: number; tempMax: number; pop: number; condition: string }[] = []
    for (const [date, hs] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (hs.length < 8) continue // 하루를 대표하기엔 시간이 너무 적은 날은 중기예보에 맡긴다
      const wet = hs.find((h) => h.precip !== 'none')
      const noon = hs.find((h) => toKstParts(h.targetAt).hour >= 12) ?? hs[0]!
      const temps = hs.map((h) => h.temp)
      daily.push({
        date,
        tempMin: Math.round(short.dailyMin[date] ?? Math.min(...temps)),
        tempMax: Math.round(short.dailyMax[date] ?? Math.max(...temps)),
        pop: Math.max(...hs.map((h) => h.pop)),
        condition: wet ? wet.precip : (noon.sky ?? 'cloudy'),
      })
    }
    try {
      for (const m of await ensureMidTerm(region, now)) {
        if (m.date <= today || daily.some((d) => d.date === m.date)) continue
        daily.push({
          date: m.date,
          tempMin: Math.round(m.tempMin),
          tempMax: Math.round(m.tempMax),
          pop: m.pop,
          condition: m.precip !== 'none' ? m.precip : skyKindFromText(m.skyText),
        })
      }
    } catch {
      // 중기예보를 못 받아도 오늘 화면은 그대로 보여준다
    }
    daily.sort((a, b) => a.date.localeCompare(b.date))
    res.json({
      daily: daily.slice(0, 6),
      hourly,
      location: target?.name ?? user.locationName,
      temp: Math.round(current.temp),
      // 지금 기온이 실제 관측값이면 관측 시각(정시), 예보값이면 null
      observedAt: nowcast ? nowcast.observedAt.toISOString() : null,
      feels: Math.round(f.feels),
      rainChance: current.pop,
      humidity: current.humidity,
      tempMin,
      tempMax,
      wind: { speed: current.wind, label: windLabel(current.wind) },
      dust: air && dustGrade ? { pm10: air.pm10, pm25: air.pm25, grade: dustGradeLabel[dustGrade] ?? null } : null,
      condition,
      flags,
      feelsMethod: f.method,
      stale: short.stale,
      forecastIssuedAt: short.issuedAt.toISOString(),
    })
  }),
)

recommendationsRouter.get(
  '/today',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: (req as AuthedRequest).userId } })
    const target = await resolveTarget(user.id, req.query)
    res.json(await todayRecommendation(user, new Date(), target?.region))
  }),
)

const feedbackSchema = z.object({
  rating: z.enum(feedbackMap.uiValues),
  period: z.enum(['MORNING', 'DAY', 'EVENING']).optional(),
  actualTemperature: z.number().min(-60).max(60).optional(),
})

recommendationsRouter.post(
  '/:id/feedback',
  requireAuth,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id)
    const body = parse(feedbackSchema, req.body)
    const userId = (req as AuthedRequest).userId
    const rec = await prisma.recommendation.findFirst({ where: { id, userId } })
    if (!rec) throw notFound('추천을 찾을 수 없어요.')
    const rating = feedbackMap.toDb(body.rating)
    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.feedback.findUnique({ where: { userId_recommendationId: { userId, recommendationId: id } } })
      if (dup) return { created: false }
      await tx.feedback.create({ data: { userId, recommendationId: id, rating, period: body.period ?? null, actualTemperature: body.actualTemperature ?? null } })
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      const lim = ruleConfig.feedbackOffsetLimit
      const next = Math.max(-lim, Math.min(lim, u.feedbackOffset + ruleConfig.feedbackStep[rating]))
      await tx.user.update({ where: { id: userId }, data: { feedbackOffset: next } })
      return { created: true }
    })
    if (!result.created) throw new AppError(409, 'FEEDBACK_EXISTS', '이미 피드백을 남겼어요.')
    res.status(201).json({ ok: true })
  }),
)
