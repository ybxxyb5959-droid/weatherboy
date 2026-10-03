import { describe, expect, it } from 'vitest'
import { recommend, requiredWarmthFor, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { feelsLike } from '../../src/rules/feelsLike.js'
import { deriveClothing } from '../../src/rules/clothing.js'
import { latLngToGrid } from '../../src/utils/grid.js'
import { clothingTypeMap, colorMap, eventKindMap, feedbackMap, sensitivityMap, thicknessMap } from '../../src/config/mappings.js'
import type { ClothingType, Thickness } from '@prisma/client'

let seq = 0
function cloth(type: ClothingType, thickness: Thickness = 'NORMAL', o: Partial<WardrobeItem> = {}): WardrobeItem {
  const d = deriveClothing(type, thickness)
  return { id: `c${String(++seq).padStart(3, '0')}`, type, thickness, color: 'GRAY', category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true, ...o }
}
const closet = (): WardrobeItem[] => [
  cloth('SHORT_SLEEVE', 'THIN'),
  cloth('LONG_SLEEVE'),
  cloth('SWEATSHIRT'),
  cloth('KNIT', 'THICK'),
  cloth('PANTS'),
  cloth('SHORTS', 'THIN'),
  cloth('WINDBREAKER', 'THIN', { windproof: true, waterproof: true }),
  cloth('JACKET', 'NORMAL', { windproof: true }),
  cloth('COAT', 'THICK', { windproof: true }),
  cloth('PADDING', 'THICK', { windproof: true }),
]
const pts = (temp: number, o: Partial<OutingPoint> = {}): OutingPoint[] => [
  { at: new Date('2026-10-02T00:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2, ...o },
  { at: new Date('2026-10-02T06:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2, ...o },
]
const run = (temp: number, o: Partial<EngineInput> = {}) =>
  recommend({ points: pts(temp), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: closet(), airGrade: 2, ...o })
const types = (r: ReturnType<typeof run>) => r.items.map((i) => i.type)

describe('requiredWarmthFor', () => {
  it.each([
    [30, 1], [28, 1], [25, 2], [23, 2], [21, 3], [20, 3], [18, 4], [17, 4],
    [14, 6], [12, 6], [10, 8], [9, 8], [6, 10], [5, 10], [4, 13], [-10, 13],
  ])('%d℃ -> %d', (t, req) => expect(requiredWarmthFor(t)).toBe(req))
})

describe('recommend', () => {
  it('더운 날: 겉옷 없이 가볍게', () => {
    const r = run(30)
    expect(r.needOuter).toBe(false)
    expect(types(r)).toEqual(['반팔', '반바지'])
  })
  it('23~27℃: 겉옷 없음', () => expect(run(25).needOuter).toBe(false))
  it('20~22℃: 필요 보온 3', () => expect(run(21).requiredWarmth).toBe(3))
  it('17~19℃: 필요 보온 4', () => expect(run(18).requiredWarmth).toBe(4))
  it('12~16℃: 필요 보온 6 이상을 만족', () => {
    const r = run(14)
    expect(r.requiredWarmth).toBe(6)
    expect(r.insufficientWardrobe).toBe(false)
  })
  it('9~11℃: 겉옷 필요', () => expect(run(10).needOuter).toBe(true))
  it('5~8℃: 두꺼운 겉옷', () => expect(['코트', '패딩']).toContain(run(6).items.at(-1)!.type))
  it('4℃ 이하: 필요 보온 13을 옷장 최대로 대응', () => {
    const r = run(0)
    expect(r.requiredWarmth).toBe(13)
    expect(r.needOuter).toBe(true)
  })
  it('추위 많이 탐은 더 따뜻하게(판단 기온 -2)', () => {
    expect(run(15, { sensitivity: 'COLD' }).judgedTemp).toBe(13)
    expect(run(15, { sensitivity: 'COLD' }).reasonCodes).toContain('SENSITIVITY_COLD')
  })
  it('더위 많이 탐은 판단 기온 +2', () => expect(run(15, { sensitivity: 'HOT' }).judgedTemp).toBe(17))
  it('feedbackOffset 반영', () => expect(run(15, { feedbackOffset: -1 }).judgedTemp).toBe(14))
  it('비 70%: 우산 true, 방수 겉옷 우선', () => {
    const c = [cloth('SWEATSHIRT'), cloth('PANTS'), cloth('JACKET', 'NORMAL', { windproof: true }), cloth('WINDBREAKER', 'NORMAL', { waterproof: true })]
    const r = recommend({ points: pts(14, { pop: 70, precip: 'rain' }), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: c, airGrade: 2 })
    expect(r.needUmbrella).toBe(true)
    expect(r.items.at(-1)!.type).toBe('바람막이')
  })
  it('강수확률 59%, 강수형태 없음: 우산 false', () => {
    expect(recommend({ points: pts(15, { pop: 59 }), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: closet(), airGrade: 2 }).needUmbrella).toBe(false)
  })
  it('미세먼지 보통은 마스크 false, 나쁨은 true, 데이터 없음은 false', () => {
    expect(run(15, { airGrade: 2 }).needMask).toBe(false)
    expect(run(15, { airGrade: 3 }).needMask).toBe(true)
    expect(run(15, { airGrade: 4 }).needMask).toBe(true)
    const none = run(15, { airGrade: null })
    expect(none.needMask).toBe(false)
    expect(none.reasonCodes).toContain('DUST_UNAVAILABLE')
  })
  it('캠핑은 같은 기온에서 더 따뜻하게 판단', () => {
    expect(run(15, { eventKind: 'CAMPING' }).judgedTemp).toBeLessThan(run(15, { eventKind: 'COMMUTE' }).judgedTemp)
  })
  it('운동은 더 가볍게 판단', () => {
    expect(run(15, { eventKind: 'EXERCISE' }).judgedTemp).toBeGreaterThan(run(15, { eventKind: 'COMMUTE' }).judgedTemp)
  })
  it('큰 일교차: reason code 및 최저 기온 반영', () => {
    const points: OutingPoint[] = [
      { at: new Date('2026-10-02T00:00:00Z'), temp: 8, feels: 8, pop: 0, precip: 'none', wind: 1 },
      { at: new Date('2026-10-02T06:00:00Z'), temp: 22, feels: 22, pop: 0, precip: 'none', wind: 1 },
    ]
    const r = recommend({ points, sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: 'TRAVEL', clothes: closet(), airGrade: 1 })
    expect(r.reasonCodes).toContain('LARGE_DIURNAL_RANGE')
    expect(r.judgedTemp).toBeLessThan(15)
  })
  it('강풍: 방풍 겉옷 우선', () => {
    const r = recommend({ points: pts(14, { wind: 9 }), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: closet(), airGrade: 2 })
    expect(r.reasonCodes).toContain('WIND_STRONG')
    const outerType = r.items.at(-1)!.type
    expect(['바람막이', '자켓', '코트', '패딩']).toContain(outerType)
  })
  it('옷장 부족: insufficientWardrobe + 보유 옷만 반환', () => {
    const small = [cloth('SHORT_SLEEVE', 'THIN'), cloth('SHORTS', 'THIN')]
    const r = run(0, { clothes: small })
    expect(r.insufficientWardrobe).toBe(true)
    expect(r.items.every((i) => i.owned)).toBe(true)
  })
  it('빈 옷장: 일반 타입 추천(owned=false)', () => {
    const r = run(15, { clothes: [] })
    expect(r.items.length).toBeGreaterThanOrEqual(2)
    expect(r.items.every((i) => !i.owned && i.clothingId === null)).toBe(true)
  })
  it('결정론: 같은 입력 -> 같은 출력', () => {
    const c = closet()
    expect(JSON.stringify(run(13, { clothes: c }))).toBe(JSON.stringify(run(13, { clothes: c })))
  })
  it('decisionKey는 기온이 조금 변해도 같은 조합이면 동일', () => {
    expect(run(18.8).decisionKey).toBe(run(18.0).decisionKey)
  })
  it('대안은 최선과 다른 조합', () => {
    const r = run(15)
    const best = JSON.stringify(r.items)
    for (const a of r.alternatives) expect(JSON.stringify(a)).not.toBe(best)
  })
})

describe('feelsLike (기상청 공식)', () => {
  it('겨울: 10℃ 이하 & 풍속 1.3 이상에서 풍속냉각', () => {
    const r = feelsLike({ tempC: 5, windMs: 5, month: 12 })
    expect(r.method).toBe('WINTER_WINDCHILL')
    expect(r.feels).toBeLessThan(5)
  })
  it('겨울: 10℃ 초과면 기온 fallback', () => {
    expect(feelsLike({ tempC: 15, windMs: 5, month: 11 })).toEqual({ feels: 15, method: 'FALLBACK_TEMP' })
  })
  it('여름: 습도 있으면 Stull 식', () => {
    expect(feelsLike({ tempC: 30, humidity: 70, month: 7 }).method).toBe('SUMMER_STULL')
  })
  it('여름 습도 없음: fallback', () => {
    expect(feelsLike({ tempC: 30, month: 7 }).method).toBe('FALLBACK_TEMP')
  })
})

describe('latLngToGrid (기상청 DFS)', () => {
  it('서울 시청 부근 = (60,127)', () => expect(latLngToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 }))
  it('광주 = (58,74)', () => expect(latLngToGrid(35.1595, 126.8526)).toEqual({ nx: 58, ny: 74 }))
  it('대전 = (67,100)', () => expect(latLngToGrid(36.3504, 127.3845)).toEqual({ nx: 67, ny: 100 }))
  it('부산 = (98,76)', () => expect(latLngToGrid(35.1796, 129.0756)).toEqual({ nx: 98, ny: 76 }))
})

describe('enum 매핑', () => {
  it('왕복 변환', () => {
    for (const k of sensitivityMap.uiValues) expect(sensitivityMap.toUi(sensitivityMap.toDb(k))).toBe(k)
    for (const k of clothingTypeMap.uiValues) expect(clothingTypeMap.toUi(clothingTypeMap.toDb(k))).toBe(k)
    for (const k of thicknessMap.uiValues) expect(thicknessMap.toUi(thicknessMap.toDb(k))).toBe(k)
    for (const k of colorMap.uiValues) expect(colorMap.toUi(colorMap.toDb(k))).toBe(k)
    for (const k of eventKindMap.uiValues) expect(eventKindMap.toUi(eventKindMap.toDb(k))).toBe(k)
    for (const k of feedbackMap.uiValues) expect(feedbackMap.toUi(feedbackMap.toDb(k))).toBe(k)
  })
  it('개수', () => {
    expect(clothingTypeMap.uiValues).toHaveLength(15)
    expect(colorMap.uiValues).toHaveLength(16)
  })
})
