import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { suggestRegions } from '../../data/regions.js'
import { prisma } from '../../db.js'
import { reverseGeocode } from '../../services/kakao/kakaoLocal.js'
import { placeHintSchema, resolveLocation } from '../../services/location.js'
import { AppError, badRequest, notFound } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const placesRouter = Router()
// 자동완성은 글자를 칠 때마다 호출되므로 넉넉하게
const suggestLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ code: 'RATE_LIMITED', message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' })
  },
})

// 지역 자동완성: '서' -> 서울, 서울 서대문구 ...
placesRouter.get('/places/suggest', requireAuth, suggestLimiter, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length > 30) throw badRequest('검색어가 너무 길어요.')
  res.json(suggestRegions(q).map(({ name, sido, district }) => ({ name, sido, district })))
})

// 현재 위치(GPS 좌표) -> 지역 이름. 한국 밖이거나 바다 한가운데면 422.
const reverseQuery = z.object({ lat: z.coerce.number().min(30).max(40), lng: z.coerce.number().min(120).max(135) })
placesRouter.get(
  '/places/reverse',
  requireAuth,
  suggestLimiter,
  wrap(async (req, res) => {
    const q = parse(reverseQuery, req.query)
    const region = await reverseGeocode(q.lat, q.lng)
    if (!region) throw new AppError(422, 'LOCATION_NOT_FOUND', '이 위치의 지역을 찾지 못했어요. 지역을 직접 검색해보세요.')
    res.json({ ...region, latitude: q.lat, longitude: q.lng })
  }),
)

const MAX_FAVORITES = 10

const favoriteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  place: placeHintSchema.optional(),
})

const serialize = (f: { id: string; name: string; address: string; latitude: number; longitude: number; regionSido: string | null; regionDistrict: string | null }) => ({
  id: f.id,
  name: f.name,
  address: f.address,
  latitude: f.latitude,
  longitude: f.longitude,
  regionSido: f.regionSido,
  regionDistrict: f.regionDistrict,
})

placesRouter.get(
  '/favorites',
  requireAuth,
  wrap(async (req, res) => {
    const rows = await prisma.favoritePlace.findMany({ where: { userId: (req as AuthedRequest).userId }, orderBy: { createdAt: 'asc' } })
    res.json(rows.map(serialize))
  }),
)

placesRouter.post(
  '/favorites',
  requireAuth,
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const b = parse(favoriteSchema, req.body)
    const exists = await prisma.favoritePlace.findUnique({ where: { userId_name: { userId, name: b.name } } })
    if (exists) {
      res.json(serialize(exists)) // 이미 담아둔 지역이면 그대로 돌려준다
      return
    }
    if ((await prisma.favoritePlace.count({ where: { userId } })) >= MAX_FAVORITES) {
      throw new AppError(409, 'FAVORITES_LIMIT', `즐겨찾기는 ${MAX_FAVORITES}곳까지 담을 수 있어요.`)
    }
    const loc = await resolveLocation(b.name, b.place)
    if (!loc) throw new AppError(422, 'LOCATION_NOT_FOUND', '위치를 찾지 못했어요. 다른 이름으로 검색해보세요.')
    const row = await prisma.favoritePlace.create({
      data: { userId, name: b.name, address: b.name, latitude: loc.latitude, longitude: loc.longitude, gridNx: loc.gridNx, gridNy: loc.gridNy, regionSido: loc.regionSido, regionDistrict: loc.regionDistrict },
    })
    res.status(201).json(serialize(row))
  }),
)

placesRouter.delete(
  '/favorites/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id)
    const r = await prisma.favoritePlace.deleteMany({ where: { id, userId: (req as AuthedRequest).userId } })
    if (r.count === 0) throw notFound('즐겨찾기를 찾을 수 없어요.')
    res.status(204).end()
  }),
)
