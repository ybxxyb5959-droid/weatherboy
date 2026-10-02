import { z } from 'zod'
import { prisma } from '../db.js'
import { AppError, notFound } from '../utils/errors.js'
import { resolveLocation } from './location.js'
import type { Region } from './weather/weatherService.js'

/** 날씨/추천 조회에서 "내 기본 위치" 대신 볼 지역을 고르는 쿼리. 둘 다 없으면 기본 위치. */
export const targetQuerySchema = z.object({
  favoriteId: z.string().uuid().optional(),
  place: z.string().trim().min(1).max(100).optional(),
})

export interface Target {
  name: string
  region: Region
}

export async function resolveTarget(userId: string, query: unknown): Promise<Target | null> {
  const q = targetQuerySchema.safeParse(query)
  if (!q.success) throw new AppError(400, 'VALIDATION_ERROR', '입력값을 확인해주세요.')
  const { favoriteId, place } = q.data
  if (favoriteId) {
    const f = await prisma.favoritePlace.findFirst({ where: { id: favoriteId, userId } })
    if (!f) throw notFound('즐겨찾기를 찾을 수 없어요.')
    return { name: f.name, region: { nx: f.gridNx, ny: f.gridNy, sido: f.regionSido, district: f.regionDistrict } }
  }
  if (place) {
    const loc = await resolveLocation(place)
    if (!loc) throw new AppError(422, 'LOCATION_NOT_FOUND', '위치를 찾지 못했어요. 다른 이름으로 검색해보세요.')
    return { name: place, region: { nx: loc.gridNx, ny: loc.gridNy, sido: loc.regionSido, district: loc.regionDistrict } }
  }
  return null
}
