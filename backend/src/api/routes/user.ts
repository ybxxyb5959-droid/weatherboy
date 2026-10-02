import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { sampleClothes } from '../../config/sampleClothes.js'
import { clothingTypeMap, colorMap, sensitivityMap, thicknessMap } from '../../config/mappings.js'
import { prisma } from '../../db.js'
import { geocode } from '../../services/kakao/kakaoLocal.js'
import { placeHintSchema, resolveLocation } from '../../services/location.js'
import { serializeSettings } from '../../services/serializers.js'
import { deriveClothing } from '../../rules/clothing.js'
import { badRequest } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const userRouter = Router()

const sensitivity = z.enum(sensitivityMap.uiValues)
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

// 하루 패턴: 외출 시간, 들어오는 시간, 요일(0=일 ~ 6=토). 시간은 null 이면 '모름'.
const routineSchema = z
  .object({
    outAt: hhmm.nullable(),
    homeAt: hhmm.nullable(),
    days: z.array(z.number().int().min(0).max(6)).max(7),
  })
  .partial()

const settingsSchema = z
  .object({
    sensitivity,
    location: z.string().trim().min(1).max(100),
    notifyEvent: z.boolean(),
    notifyChange: z.boolean(),
    notifyMorning: z.boolean(),
    notifyRain: z.boolean(),
    notifyColdReturn: z.boolean(),
    notifyDust: z.boolean(),
    notifyFeedback: z.boolean(),
    notifyCloset: z.boolean(),
    notifyNotice: z.boolean(),
    morningLeadMin: z.number().int().refine((n) => [15, 30, 45, 60].includes(n), '15/30/45/60분 중에서 골라주세요'),
    place: placeHintSchema.optional(),
    routine: routineSchema,
  })
  .partial()

const onboardingSchema = settingsSchema.extend({
  closetMode: z.enum(['sample', 'empty']).optional(),
  // "나중에 할게": 기본 설정 + 빈 옷장으로 완료 처리 (옷은 나중에 등록하고, 그 전엔 일반 추천)
  skip: z.boolean().optional(),
})

async function applySettings(userId: string, body: z.infer<typeof settingsSchema>) {
  const data: Record<string, unknown> = {}
  if (body.sensitivity) data.sensitivity = sensitivityMap.toDb(body.sensitivity)
  if (body.notifyEvent !== undefined) data.notifyEvent = body.notifyEvent
  if (body.notifyChange !== undefined) data.notifyChange = body.notifyChange
  if (body.notifyMorning !== undefined) data.notifyMorning = body.notifyMorning
  if (body.notifyRain !== undefined) data.notifyRain = body.notifyRain
  if (body.notifyColdReturn !== undefined) data.notifyColdReturn = body.notifyColdReturn
  if (body.notifyDust !== undefined) data.notifyDust = body.notifyDust
  if (body.notifyFeedback !== undefined) data.notifyFeedback = body.notifyFeedback
  if (body.notifyCloset !== undefined) data.notifyCloset = body.notifyCloset
  if (body.notifyNotice !== undefined) data.notifyNotice = body.notifyNotice
  if (body.morningLeadMin !== undefined) data.morningLeadMin = body.morningLeadMin
  if (body.routine) {
    const r = body.routine
    if (r.outAt !== undefined) data.routineOutAt = r.outAt
    if (r.homeAt !== undefined) data.routineHomeAt = r.homeAt
    if (r.days !== undefined) data.routineDays = [...new Set(r.days)].sort()
  }
  if (body.location) {
    const loc = await resolveLocation(body.location, body.place)
    data.locationName = body.location
    data.latitude = loc?.latitude ?? null
    data.longitude = loc?.longitude ?? null
    data.gridNx = loc?.gridNx ?? null
    data.gridNy = loc?.gridNy ?? null
    data.regionSido = loc?.regionSido ?? null
    data.regionDistrict = loc?.regionDistrict ?? null
  }
  return prisma.user.update({ where: { id: userId }, data })
}

userRouter.get(
  '/settings',
  requireAuth,
  wrap(async (req, res) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: (req as AuthedRequest).userId } })
    res.json(serializeSettings(u))
  }),
)

userRouter.put(
  '/settings',
  requireAuth,
  wrap(async (req, res) => {
    const body = parse(settingsSchema, req.body)
    const u = await applySettings((req as AuthedRequest).userId, body)
    res.json(serializeSettings(u))
  }),
)

userRouter.post(
  '/onboarding/complete',
  requireAuth,
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const body = parse(onboardingSchema, req.body ?? {})
    const skip = body.skip === true
    const closetMode = skip ? 'empty' : (body.closetMode ?? 'sample')
    const settingsBody = skip ? { location: '서울 마포구' } : body
    // 이미 옷이 있는 사용자에게는 예시 옷을 중복 생성하지 않는다.
    const existing = await prisma.clothing.count({ where: { userId } })
    await applySettings(userId, settingsBody)
    if (closetMode === 'sample' && existing === 0) {
      await prisma.clothing.createMany({
        data: sampleClothes.map((c) => {
          const type = clothingTypeMap.toDb(c.type)
          const thickness = thicknessMap.toDb(c.thickness)
          return { userId, isSample: true, type, thickness, color: colorMap.toDb(c.color), windproof: c.windproof, waterproof: c.waterproof, ...deriveClothing(type, thickness) }
        }),
      })
    }
    const u = await prisma.user.update({ where: { id: userId }, data: { onboardingDone: true } })
    res.json({ onboardingDone: true, settings: serializeSettings(u) })
  }),
)

const geocodeLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ code: 'RATE_LIMITED', message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' })
  },
})

userRouter.get(
  '/geocode',
  requireAuth,
  geocodeLimiter,
  wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q || q.length > 100) throw badRequest('검색어를 입력해주세요.')
    const results = await geocode(q)
    res.json(results.map(({ name, address, latitude, longitude, regionSido, regionDistrict }) => ({ name, address, latitude, longitude, regionSido, regionDistrict })))
  }),
)
