import type { ClothingCategory, ClothingType, Thickness } from '@prisma/client'
import { categoryOfType } from '../config/mappings.js'
import { ruleConfig } from '../config/ruleConfig.js'

/** type/thickness 로부터 category, warmth 를 서버가 계산한다. */
export function deriveClothing(type: ClothingType, thickness: Thickness): { category: ClothingCategory; warmth: number } {
  const warmth = Math.max(0.5, ruleConfig.baseWarmth[type] + ruleConfig.thicknessAdjust[thickness])
  return { category: categoryOfType[type], warmth }
}

/**
 * 사용자가 두께/방풍/방수를 직접 고르지 않으면 옷 종류만 보고 정한다.
 * 보온 정도는 종류별 기본 점수(baseWarmth)에 이미 들어 있어서 두께는 '보통'이면 된다 (패딩은 원래 따뜻한 옷으로 계산된다).
 * 방풍/방수는 일반 추천에서 쓰는 기준과 같다: 겉옷은 방풍(자켓 제외), 방수는 바람막이만.
 */
export function defaultsForType(type: ClothingType): { thickness: Thickness; windproof: boolean; waterproof: boolean } {
  const outer = categoryOfType[type] === 'LIGHT_OUTER' || categoryOfType[type] === 'HEAVY_OUTER'
  return { thickness: 'NORMAL', windproof: outer && type !== 'JACKET', waterproof: type === 'WINDBREAKER' }
}
