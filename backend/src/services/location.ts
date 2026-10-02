import { z } from 'zod'
import { AppError } from '../utils/errors.js'
import { latLngToGrid } from '../utils/grid.js'
// 프론트 빠른 선택 4곳의 대표 좌표(구/시 중심 근사). Kakao Local 키가 없거나 장애일 때만 사용.
const PRESETS: Record<string, { lat: number; lng: number; sido: string; district: string }> = {
  '서울 마포구': { lat: 37.5663, lng: 126.9019, sido: '서울', district: '마포구' },
  '서울 강남구': { lat: 37.5172, lng: 127.0473, sido: '서울', district: '강남구' },
  '부산 해운대구': { lat: 35.1631, lng: 129.1635, sido: '부산', district: '해운대구' },
  '제주시': { lat: 33.4996, lng: 126.5312, sido: '제주', district: '제주시' },
}

import { findRegion } from '../data/regions.js'
import { geocode, kakaoLocalConfigured, normalizeSido } from './kakao/kakaoLocal.js'

// 장소 텍스트 -> 좌표 캐시 (카카오 응답만 저장)
const resolveCache = new Map<string, ResolvedLocation>()

export const placeHintSchema = z.object({
  latitude: z.number().min(30).max(40),
  longitude: z.number().min(120).max(135),
  regionSido: z.string().optional(),
  regionDistrict: z.string().nullable().optional(),
})

export interface ResolvedLocation {
  latitude: number
  longitude: number
  gridNx: number
  gridNy: number
  regionSido: string | null
  regionDistrict: string | null
}

/**
 * 장소 텍스트를 좌표/격자/시도로 변환.
 *  - 클라이언트가 /api/geocode 결과의 좌표를 함께 보내면 그대로 사용
 *  - 아니면 Kakao Local 로 검색 (결과 없음 -> 422, 키 미설정/장애 -> null 반환: 텍스트만 저장)
 */
export async function resolveLocation(text: string, hint?: z.infer<typeof placeHintSchema>): Promise<ResolvedLocation | null> {
  if (hint) {
    const { nx, ny } = latLngToGrid(hint.latitude, hint.longitude)
    return {
      latitude: hint.latitude,
      longitude: hint.longitude,
      gridNx: nx,
      gridNy: ny,
      regionSido: normalizeSido(hint.regionSido ?? text),
      regionDistrict: hint.regionDistrict ?? text.split(/\s+/)[1] ?? null,
    }
  }
  const known = findRegion(text) // 내장 지역 목록의 이름이면 시/도는 목록 기준으로 확정한다
  const cacheKey = text.trim()
  const cached = resolveCache.get(cacheKey)
  if (cached) return cached
  const preset = PRESETS[text.trim()]
  const fromPreset = (): ResolvedLocation | null => {
    if (!preset) return null
    const { nx, ny } = latLngToGrid(preset.lat, preset.lng)
    return { latitude: preset.lat, longitude: preset.lng, gridNx: nx, gridNy: ny, regionSido: preset.sido, regionDistrict: preset.district }
  }
  if (!kakaoLocalConfigured()) return fromPreset()
  let results
  try {
    results = await geocode(known?.query ?? text)
  } catch (e) {
    if (e instanceof AppError) return fromPreset()
    throw e
  }
  const r = results[0]
  if (!r) throw new AppError(422, 'LOCATION_NOT_FOUND', '위치를 찾지 못했어요. 다른 이름으로 검색해보세요.')
  const resolved: ResolvedLocation = {
    latitude: r.latitude,
    longitude: r.longitude,
    gridNx: r.gridNx,
    gridNy: r.gridNy,
    regionSido: known?.entry.sido ?? r.regionSido,
    regionDistrict: known ? known.entry.district : r.regionDistrict,
  }
  resolveCache.set(cacheKey, resolved) // 지역 좌표는 거의 변하지 않으므로 프로세스 동안 캐시(카카오 호출 절약)
  return resolved
}
