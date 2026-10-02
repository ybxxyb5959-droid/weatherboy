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

describe('신고된 상황: 새로 담은 옷이 오늘 추천에 안 나오거나 늘 같은 옷만 나온다', () => {
  const NOW = new Date('2026-10-05T03:00:00Z')
  const old = new Date('2026-09-01T00:00:00Z')
  const recent = new Date('2026-10-04T03:00:00Z') // 하루 전에 담음
  // 12℃(필요 보온 6): 겉옷 없이 채우는 상의는 두꺼운 니트 하나뿐이다
  const baseCloset = () => [
    cloth('KNIT', 'GRAY', 'THICK', { createdAt: old }), // 보온 4+1=5
    cloth('LONG_SLEEVE', 'BEIGE', 'NORMAL', { createdAt: old }),
    cloth('SWEATSHIRT', 'GRAY', 'NORMAL', { createdAt: old }),
    cloth('PANTS', 'BLUE', 'NORMAL', { createdAt: old }),
    cloth('PANTS', 'BLACK', 'NORMAL', { createdAt: old }),
    cloth('WINDBREAKER', 'GREEN', 'NORMAL', { createdAt: old }),
    cloth('PADDING', 'BLACK', 'THICK', { createdAt: old }),
  ]
  const runAt = (clothes: WardrobeItem[], temp: number, seed: string) =>
    recommend({ points: pts(temp), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed, now: NOW } as EngineInput)

  it('최근에 담은 가디건은 선선한 날 바로 추천에 들어간다', () => {
    const closet = baseCloset()
    const cardigan = cloth('CARDIGAN', 'NAVY', 'NORMAL', { createdAt: recent })
    closet.push(cardigan)
    for (const d of days) {
      const r = runAt(closet, 12, d)
      expect(r.insufficientWardrobe).toBe(false)
      expect(r.items.map((i) => i.clothingId)).toContain(cardigan.id)
    }
  })

  it('최근에 담은 상의도 후보로 쓰인다', () => {
    const closet = baseCloset()
    const hoodie = cloth('HOODIE', 'BLACK', 'THICK', { createdAt: recent })
    closet.push(hoodie)
    for (const d of days) expect(runAt(closet, 12, d).items.map((i) => i.clothingId)).toContain(hoodie.id)
  })

  it('새 옷이 없어도 같은 조건에서 여러 가지 조합이 돌아가며 나온다 (한 가지로 굳지 않는다)', () => {
    const closet = baseCloset()
    const combos = new Set(days.map((d) => ids(runAt(closet, 12, d))))
    expect(combos.size).toBeGreaterThanOrEqual(3)
    const tops = new Set(days.map((d) => runAt(closet, 12, d).items[0]!.type))
    expect(tops.size).toBeGreaterThanOrEqual(2) // 바지만 바뀌는 게 아니라 상의도 바뀐다
  })

  it('더운 날에는 최근에 담은 가디건이 있어도 걸치지 않는다', () => {
    const closet = baseCloset()
    closet.push(cloth('SHORT_SLEEVE', 'WHITE', 'THIN', { createdAt: old }), cloth('SHORTS', 'BLACK', 'THIN', { createdAt: old }), cloth('CARDIGAN', 'NAVY', 'NORMAL', { createdAt: recent }))
    for (const d of days) expect(runAt(closet, 28, d).needOuter).toBe(false)
  })

  it('같은 날에는 몇 번을 물어도 같은 조합이다', () => {
    const closet = baseCloset()
    closet.push(cloth('CARDIGAN', 'NAVY', 'NORMAL', { createdAt: recent }))
    const a = ids(runAt(closet, 12, 'u1:2026-10-05'))
    for (let i = 0; i < 5; i++) expect(ids(runAt(closet, 12, 'u1:2026-10-05'))).toBe(a)
  })
})

describe('"다른 조합 보기": 서로 다른 옷이 나온다', () => {
  const NOW = new Date('2026-10-05T03:00:00Z')
  const old = new Date('2026-09-01T00:00:00Z')
  const recent = new Date('2026-10-04T03:00:00Z')
  const closet = (extra: WardrobeItem[] = []) => [
    cloth('KNIT', 'GRAY', 'THICK', { createdAt: old }),
    cloth('HOODIE', 'BLACK', 'NORMAL', { createdAt: old }),
    cloth('SWEATSHIRT', 'GRAY', 'NORMAL', { createdAt: old }),
    cloth('LONG_SLEEVE', 'BEIGE', 'NORMAL', { createdAt: old }),
    cloth('PANTS', 'BLUE', 'NORMAL', { createdAt: old }),
    cloth('PANTS', 'BLUE', 'NORMAL', { createdAt: old }), // 겉보기에 똑같은 바지
    cloth('PANTS', 'BLACK', 'NORMAL', { createdAt: old }),
    cloth('WINDBREAKER', 'GREEN', 'NORMAL', { createdAt: old }),
    cloth('CARDIGAN', 'BEIGE', 'NORMAL', { createdAt: old }),
    ...extra,
  ]
  const runAt = (clothes: WardrobeItem[], seed: string) =>
    recommend({ points: pts(12), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed, now: NOW } as EngineInput)
  const label = (items: { label: string }[]) => items.map((i) => i.label).join(' + ')

  it('메인과 대안이 모두 다른 조합이고, 같은 이름의 조합은 반복되지 않는다', () => {
    for (const d of days) {
      const r = runAt(closet(), d)
      const all = [label(r.items), ...r.alternatives.map(label)]
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('대안에는 메인과 다른 상의가 들어 있다 (바지만 바꾼 변형으로 채우지 않는다)', () => {
    for (const d of days) {
      const r = runAt(closet(), d)
      const tops = new Set([r.items[0]!.type, ...r.alternatives.map((a) => a[0]!.type)])
      expect(tops.size).toBeGreaterThanOrEqual(2)
    }
  })

  it('최근에 담은 옷은 메인이 아니어도 대안에서 볼 수 있다', () => {
    const fresh = cloth('SHIRT', 'WHITE', 'NORMAL', { createdAt: recent })
    const upper = cloth('SWEATSHIRT', 'NAVY', 'THICK', { createdAt: recent })
    for (const d of days) {
      const r = runAt(closet([fresh, upper]), d)
      const used = new Set([...r.items, ...r.alternatives.flat()].map((i) => i.clothingId))
      expect(used.has(upper.id)).toBe(true)
    }
  })
})

describe('지나치게 두꺼운 조합은 권하지 않는다 (21℃에 패딩 추천 방지)', () => {
  // 옷장이 작다: 반팔, 반바지, 그리고 겉옷은 패딩 하나뿐
  const small = () => [cloth('SHORT_SLEEVE', 'WHITE', 'NORMAL'), cloth('SHORTS', 'BLACK', 'NORMAL'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
  const types = (r: ReturnType<typeof run>) => r.items.map((i) => i.type)

  it.each([21, 18])('%d℃: 반팔+반바지에 패딩을 얹지 않고, 옷이 부족하다고 알린다', (t) => {
    for (const seed of [undefined, ...days.slice(0, 4)]) {
      const r = run(small(), t, seed)
      expect(types(r)).not.toContain('패딩')
      expect(r.insufficientWardrobe).toBe(true)
    }
  })

  it('정말 추운 날(5℃)에는 패딩을 권한다', () => {
    for (const seed of [undefined, ...days.slice(0, 4)]) expect(types(run(small(), 5, seed))).toContain('패딩')
  })

  it('알맞은 가벼운 겉옷이 있으면 그걸 쓴다 (패딩이 아니라)', () => {
    const c = [...small(), cloth('PANTS', 'BLUE'), cloth('JACKET', 'BLUE', 'NORMAL')]
    for (const seed of [undefined, ...days.slice(0, 4)]) {
      const r = run(c, 15, seed)
      expect(types(r)).not.toContain('패딩')
      expect(r.insufficientWardrobe).toBe(false)
    }
  })
})

describe('두꺼운 겉옷(패딩·코트)은 충분히 추운 날에만 쓴다', () => {
  const closet = () => [
    cloth('SHORT_SLEEVE', 'WHITE'),
    cloth('SHORTS', 'GRAY'),
    cloth('PANTS', 'BLUE'),
    cloth('SWEATSHIRT', 'GRAY'),
    cloth('PADDING', 'BLACK', 'THICK', { windproof: true }),
    cloth('COAT', 'BEIGE', 'THICK', { windproof: true }),
  ]
  const usedTypes = (temp: number, seed?: string) => run(closet(), temp, seed).items.map((i) => i.type)

  it.each([25, 21, 18, 17, 15, 13, 11, 10])('%d℃: 패딩은 추천하지 않는다', (t) => {
    for (const seed of [undefined, ...days.slice(0, 6)]) expect(usedTypes(t, seed)).not.toContain('패딩')
  })

  it.each([25, 21, 18])('%d℃: 코트도 추천하지 않는다', (t) => {
    for (const seed of [undefined, ...days.slice(0, 6)]) expect(usedTypes(t, seed)).not.toContain('코트')
  })

  it('옷장에 패딩만 겉옷으로 있어도, 선선한(15℃) 날에는 패딩 대신 모자라도 가벼운 조합으로 알린다', () => {
    const only = [cloth('SHORT_SLEEVE', 'WHITE'), cloth('SHORTS', 'GRAY'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
    for (const seed of [undefined, ...days.slice(0, 4)]) {
      const r = run(only, 15, seed)
      expect(r.items.map((i) => i.type)).not.toContain('패딩')
      expect(r.insufficientWardrobe).toBe(true)
    }
  })

  it('정말 추운 날(5℃)에는 두꺼운 겉옷(패딩·코트)을 권한다', () => {
    const t = usedTypes(5)
    expect(t.includes('패딩') || t.includes('코트')).toBe(true)
    const onlyPadding = [cloth('SWEATSHIRT', 'GRAY'), cloth('PANTS', 'BLUE'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
    expect(run(onlyPadding, 5).items.map((i) => i.type)).toContain('패딩')
  })

  it('패딩만 있는 옷장도 "옷이 비었다"로 취급하지 않는다', () => {
    const r = run([cloth('PADDING', 'BLACK', 'THICK')], 22)
    expect(r.reasonCodes).not.toContain('EMPTY_WARDROBE_GENERIC')
  })
})
