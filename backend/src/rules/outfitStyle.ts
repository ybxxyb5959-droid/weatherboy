// 옷차림 "분위기"(포멀/단정/캐주얼/편한 옷) 취향. 날씨가 정한 보온 조건은 그대로 두고, 조건을 만족하는 조합 중에서 분위기에 가까운 쪽을 고른다.
// 결정론적이다: AI 는 분위기를 고를 뿐이고 어떤 옷을 입을지는 이 점수로 정한다.
import type { ClothingPattern, ClothingType } from '@prisma/client'

export const OUTFIT_STYLES = ['FORMAL', 'SMART', 'CASUAL', 'COMFORT'] as const
export type OutfitStyle = (typeof OUTFIT_STYLES)[number]

export const styleLabel: Record<OutfitStyle, string> = {
  FORMAL: '포멀한 정장 느낌',
  SMART: '단정한 비즈니스 캐주얼',
  CASUAL: '편안한 캐주얼',
  COMFORT: '활동하기 편한 옷',
}

type Scores = Partial<Record<ClothingType, number>>

const BY_STYLE: Record<OutfitStyle, Scores> = {
  FORMAL: { SHIRT: 3, KNIT: 2, SHORT_SLEEVE_SHIRT: 1, LONG_SLEEVE: 1, SHORT_SLEEVE: -1, SWEATSHIRT: -2, HOODIE: -3, PANTS: 2, SKIRT: 2, SHORTS: -3, JACKET: 3, COAT: 3, CARDIGAN: 1, WINDBREAKER: -2, PADDING: -1 },
  SMART: { SHIRT: 3, KNIT: 3, SHORT_SLEEVE_SHIRT: 2, LONG_SLEEVE: 1, SHORT_SLEEVE: 0, SWEATSHIRT: -1, HOODIE: -2, PANTS: 2, SKIRT: 2, SHORTS: -2, JACKET: 3, COAT: 2, CARDIGAN: 3, WINDBREAKER: -1, PADDING: 0 },
  CASUAL: { SWEATSHIRT: 2, HOODIE: 2, LONG_SLEEVE: 2, SHORT_SLEEVE: 2, KNIT: 1, SHIRT: 1, PANTS: 1, SHORTS: 1, WINDBREAKER: 1, CARDIGAN: 1 },
  COMFORT: { SWEATSHIRT: 2, HOODIE: 2, LONG_SLEEVE: 2, SHORT_SLEEVE: 2, PANTS: 1, SHORTS: 2, WINDBREAKER: 3, PADDING: 1, SKIRT: -1, SHIRT: -1, JACKET: -1 },
}

const NEUTRAL = new Set(['BLACK', 'NAVY', 'GRAY', 'WHITE', 'BEIGE'])
const LOUD_PATTERN = new Set<ClothingPattern>(['PRINT', 'STRIPE', 'DOT'])

interface Piece {
  type: ClothingType
  color: string
  pattern?: ClothingPattern
}

/** 한 벌이 분위기에 얼마나 맞는지. 포멀/단정은 차분한 색과 무늬 없는 옷을 더 쳐준다. */
export function pieceStyleScore(style: OutfitStyle, c: Piece): number {
  let s = BY_STYLE[style][c.type] ?? 0
  if (style === 'FORMAL' || style === 'SMART') {
    if (NEUTRAL.has(c.color)) s += 1
    if (c.pattern && LOUD_PATTERN.has(c.pattern)) s -= 1
  }
  return s
}

export function comboStyleScore(style: OutfitStyle, top: Piece, bottom: Piece, outer: Piece | null): number {
  return pieceStyleScore(style, top) + pieceStyleScore(style, bottom) + (outer ? pieceStyleScore(style, outer) : 0)
}
