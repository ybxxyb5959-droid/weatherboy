// frontend 한국어 문자열 <-> 내부 enum 매핑 (단일 관리 지점)
import type { ClothingColor, ClothingPattern, ClothingType, EventKind, FeedbackRating, Sensitivity, Thickness, ClothingCategory } from '@prisma/client'

function bimap<K extends string, V extends string>(pairs: ReadonlyArray<readonly [K, V]>) {
  const toDb = new Map<string, V>(pairs.map(([k, v]) => [k, v]))
  const toUi = new Map<string, K>(pairs.map(([k, v]) => [v, k]))
  return {
    uiValues: pairs.map(([k]) => k) as [K, ...K[]],
    toDb: (ui: K): V => toDb.get(ui) as V,
    toUi: (db: V): K => toUi.get(db) as K,
  }
}

export const sensitivityMap = bimap<'추위 많이 탐' | '보통' | '더위 많이 탐', Sensitivity>([
  ['추위 많이 탐', 'COLD'],
  ['보통', 'NORMAL'],
  ['더위 많이 탐', 'HOT'],
])

export const clothingTypeMap = bimap<
  '반팔' | '긴팔' | '맨투맨' | '니트' | '후드티' | '바지' | '반바지' | '치마' | '바람막이' | '자켓' | '코트' | '패딩',
  ClothingType
>([
  ['반팔', 'SHORT_SLEEVE'],
  ['긴팔', 'LONG_SLEEVE'],
  ['맨투맨', 'SWEATSHIRT'],
  ['니트', 'KNIT'],
  ['후드티', 'HOODIE'],
  ['바지', 'PANTS'],
  ['반바지', 'SHORTS'],
  ['치마', 'SKIRT'],
  ['바람막이', 'WINDBREAKER'],
  ['자켓', 'JACKET'],
  ['코트', 'COAT'],
  ['패딩', 'PADDING'],
])

export const thicknessMap = bimap<'얇음' | '보통' | '두꺼움', Thickness>([
  ['얇음', 'THIN'],
  ['보통', 'NORMAL'],
  ['두꺼움', 'THICK'],
])

// 색 선택지(화면에 보이는 순서). 기타는 위 색에 해당하지 않을 때만 쓴다.
export const colorMap = bimap<
  '검정' | '회색' | '흰색' | '베이지' | '갈색' | '카키' | '초록' | '네이비' | '파랑' | '하늘색' | '빨강' | '분홍' | '주황' | '노랑' | '보라' | '기타',
  ClothingColor
>([
  ['검정', 'BLACK'],
  ['회색', 'GRAY'],
  ['흰색', 'WHITE'],
  ['베이지', 'BEIGE'],
  ['갈색', 'BROWN'],
  ['카키', 'KHAKI'],
  ['초록', 'GREEN'],
  ['네이비', 'NAVY'],
  ['파랑', 'BLUE'],
  ['하늘색', 'SKYBLUE'],
  ['빨강', 'RED'],
  ['분홍', 'PINK'],
  ['주황', 'ORANGE'],
  ['노랑', 'YELLOW'],
  ['보라', 'PURPLE'],
  ['기타', 'OTHER'],
])

export const patternMap = bimap<'무지' | '체크' | '줄무늬' | '도트' | '프린트', ClothingPattern>([
  ['무지', 'SOLID'],
  ['체크', 'CHECK'],
  ['줄무늬', 'STRIPE'],
  ['도트', 'DOT'],
  ['프린트', 'PRINT'],
])

const eventKindBase = bimap<'여행' | '캠핑' | '등산' | '야외활동' | '기타', EventKind>([
  ['여행', 'TRAVEL'],
  ['캠핑', 'CAMPING'],
  ['등산', 'HIKING'],
  ['야외활동', 'OUTDOOR'],
  ['기타', 'OTHER'],
])
export const eventKindMap = {
  ...eventKindBase,
  // 예전 값(COMMUTE/EXERCISE)이 남아 있어도 '기타'로 보여준다
  toUi: (db: EventKind) => eventKindBase.toUi(db) ?? ('기타' as const),
}

export const feedbackMap = bimap<'추웠어요' | '딱 좋아요' | '더웠어요', FeedbackRating>([
  ['추웠어요', 'COLD'],
  ['딱 좋아요', 'OK'],
  ['더웠어요', 'HOT'],
])

export const categoryOfType: Record<ClothingType, ClothingCategory> = {
  SHORT_SLEEVE: 'TOP',
  LONG_SLEEVE: 'TOP',
  SWEATSHIRT: 'TOP',
  KNIT: 'TOP',
  HOODIE: 'TOP',
  PANTS: 'BOTTOM',
  SHORTS: 'BOTTOM',
  SKIRT: 'BOTTOM',
  WINDBREAKER: 'LIGHT_OUTER',
  JACKET: 'LIGHT_OUTER',
  COAT: 'HEAVY_OUTER',
  PADDING: 'HEAVY_OUTER',
}

export const uiEnum = {
  sensitivity: sensitivityMap.uiValues,
  clothingType: clothingTypeMap.uiValues,
  thickness: thicknessMap.uiValues,
  color: colorMap.uiValues,
  eventKind: eventKindMap.uiValues,
  feedback: feedbackMap.uiValues,
}
