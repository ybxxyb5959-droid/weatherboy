import { describe, expect, it } from 'vitest'
import type { ClothingType, Thickness } from '@prisma/client'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { deriveClothing } from '../../src/rules/clothing.js'

let seq = 0
const cloth = (type: ClothingType, color = 'GRAY', thickness: Thickness = 'NORMAL', o: Partial<WardrobeItem> = {}): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `v${String(++seq).padStart(3, '0')}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true, ...o }
}
const pts = (temp: number): OutingPoint[] => [
  { at: new Date('2026-10-02T00:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
  { at: new Date('2026-10-02T06:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
]
const run = (clothes: WardrobeItem[], temp: number, seed?: string) =>
  recommend({ points: pts(temp), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed } as EngineInput)
const ids = (r: ReturnType<typeof run>) => r.items.map((i) => i.clothingId).join('+')

// 같은 정도로 따뜻한 옷이 여러 벌
const tops = [cloth('LONG_SLEEVE', 'BLACK'), cloth('LONG_SLEEVE', 'WHITE'), cloth('SHIRT', 'BLUE'), cloth('SWEATSHIRT', 'GRAY')]
const bottoms = [cloth('PANTS', 'BLACK'), cloth('PANTS', 'BLUE'), cloth('PANTS', 'BEIGE')]
const wardrobe = [...tops, ...bottoms]
const days = Array.from({ length: 14 }, (_, i) => `u1:2026-10-${String(i + 1).padStart(2, '0')}`)

describe('추천 다양성: 알맞은 조합이 여럿이면 날짜마다 돌아가며 고른다', () => {
  it('같은 사용자·같은 날이면 몇 번을 물어도 같은 조합', () => {
    const a = ids(run(wardrobe, 20, 'u1:2026-10-05'))
    for (let i = 0; i < 5; i++) expect(ids(run(wardrobe, 20, 'u1:2026-10-05'))).toBe(a)
  })

  it('날짜가 바뀌면 다른 조합이 나온다 (2주 동안 여러 가지)', () => {
    const seen = new Set(days.map((d) => ids(run(wardrobe, 20, d))))
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('다양하게 골라도 항상 필요한 보온을 채운다', () => {
    const base = run(wardrobe, 20) // 시드 없이: 가장 가벼운 알맞은 조합
    for (const d of days) {
      const r = run(wardrobe, 20, d)
      expect(r.insufficientWardrobe).toBe(false)
      expect(r.requiredWarmth).toBe(base.requiredWarmth)
      expect(r.needOuter).toBe(base.needOuter) // 겉옷 필요 여부는 날씨가 정한다
    }
  })

  it('시드가 없으면 예전처럼 항상 같은 조합 (결정적)', () => {
    expect(ids(run(wardrobe, 20))).toBe(ids(run(wardrobe, 20)))
  })

  it('옷이 하나뿐인 종류는 그대로 그 옷을 쓴다', () => {
    const small = [cloth('LONG_SLEEVE'), cloth('PANTS')]
    for (const d of days) expect(ids(run(small, 20, d))).toBe(ids(run(small, 20)))
  })
})

describe('새 옷을 담으면 추천에 반영된다', () => {
  it('새로 담은 셔츠·가디건이 추천 후보로 쓰인다', () => {
    const base = [cloth('SHORT_SLEEVE'), cloth('PANTS')]
    const shirt = cloth('SHIRT', 'WHITE')
    const cardigan = cloth('CARDIGAN', 'BEIGE')
    const withNew = [...base, shirt, cardigan]
    // 선선한 날(17℃): 겉옷이 필요하고, 새 가디건이 겉옷으로 고를 수 있는 유일한 옷
    const r = run(withNew, 17, 'u1:2026-10-05')
    expect(r.needOuter).toBe(true)
    expect(r.items.map((i) => i.clothingId)).toContain(cardigan.id)
    // 더운 날(27℃)에는 가벼운 셔츠/반팔 계열만, 가디건은 안 입는다
    expect(run(withNew, 27, 'u1:2026-10-05').needOuter).toBe(false)
  })

  it('옷이 늘면 같은 날씨에서 고를 수 있는 조합(다른 조합 보기)도 늘어난다', () => {
    const few = [cloth('LONG_SLEEVE'), cloth('PANTS')]
    const more = [...few, cloth('SHIRT'), cloth('SWEATSHIRT'), cloth('PANTS', 'BLUE')]
    expect(run(more, 20, 'u1:d').alternatives.length).toBeGreaterThan(run(few, 20, 'u1:d').alternatives.length)
  })

  it('가디건은 겉옷(가벼운 겉옷)이고 기본으로 방풍이 아니다', () => {
    const c = cloth('CARDIGAN')
    expect(c.category).toBe('LIGHT_OUTER')
    expect(c.windproof).toBe(false)
  })
})
