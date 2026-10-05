// 최종 코디의 보온 재검증. 정장·원하는 옷처럼 엔진이 고른 뒤에 옷을 바꾼 결과도 날씨(필요 보온)를 채우는지 다시 센다.
// 옷장 옷은 저장된 보온값을, 예시 옷(옷장에 없는 옷)은 "보통 두께"의 종류별 기본값을 쓴다. 순수 함수(DB·외부 호출 없음).
import { clothingTypeMap } from '../config/mappings.js'
import { deriveClothing } from './clothing.js'
import type { OutfitItem, WardrobeItem } from './outfitEngine.js'

export interface WarmthCheck {
  total: number
  required: number
  /** 필요한 보온에 못 미침 */
  short: boolean
}

const exampleWarmth = (type: string): number => {
  const db = clothingTypeMap.toDb(type as never)
  if (!db) return 0
  const w = deriveClothing(db, 'NORMAL').warmth
  return Number.isFinite(w) ? w : 0
}

/** 코디(옷장 옷 + 예시 옷)의 보온 합이 필요 보온을 채우는지 */
export function checkWarmth(items: OutfitItem[], wardrobe: WardrobeItem[], required: number): WarmthCheck {
  const byId = new Map(wardrobe.map((w) => [w.id, w.warmth]))
  const total = items.reduce((sum, it) => sum + (it.clothingId ? (byId.get(it.clothingId) ?? 0) : exampleWarmth(it.type)), 0)
  return { total, required, short: total < required }
}
