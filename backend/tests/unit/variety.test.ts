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
// 날짜와 시간대별 기온을 직접 정해 만드는 외출 구간 (계절·낮 기온 규칙 확인용). temps 의 각 값은 3시간 간격의 체감=기온.
const ptsOn = (date: string, temps: number[]): OutingPoint[] =>
  temps.map((t, i) => ({ at: new Date(`${date}T${String(i * 3).padStart(2, '0')}:00:00Z`), temp: t, feels: t, pop: 10, precip: 'none' as const, wind: 2 }))
const runOn = (clothes: WardrobeItem[], date: string, temps: number[], seed?: string) =>
  recommend({ points: ptsOn(date, temps), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed } as EngineInput)
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

  it('정말 추운 겨울날(5℃)에는 패딩을 권한다', () => {
    for (const seed of [undefined, ...days.slice(0, 4)]) expect(types(runOn(small(), '2026-01-15', [5, 5], seed))).toContain('패딩')
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
    const t = runOn(closet(), '2026-01-15', [5, 5]).items.map((i) => i.type)
    expect(t.includes('패딩') || t.includes('코트')).toBe(true)
    const onlyPadding = [cloth('SWEATSHIRT', 'GRAY'), cloth('PANTS', 'BLUE'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
    expect(runOn(onlyPadding, '2026-01-15', [5, 5]).items.map((i) => i.type)).toContain('패딩')
  })

  it('패딩만 있는 옷장도 "옷이 비었다"로 취급하지 않는다', () => {
    const r = run([cloth('PADDING', 'BLACK', 'THICK')], 22)
    expect(r.reasonCodes).not.toContain('EMPTY_WARDROBE_GENERIC')
  })
})

describe('계절과 낮 기온도 함께 본다 (패딩·코트)', () => {
  const closet = () => [
    cloth('SWEATSHIRT', 'GRAY'),
    cloth('PANTS', 'BLUE'),
    cloth('PADDING', 'BLACK', 'THICK', { windproof: true }),
    cloth('COAT', 'BEIGE', 'THICK', { windproof: true }),
  ]
  const typesOn = (date: string, temps: number[], seed?: string) => runOn(closet(), date, temps, seed).items.map((i) => i.type)

  it('철이 아닌 달(10월)에는 패딩을 쓰지 않는다 (8℃여도)', () => {
    for (const seed of [undefined, ...days.slice(0, 4)]) expect(typesOn('2026-10-20', [8, 8], seed)).not.toContain('패딩')
  })

  it('같은 8℃라도 한겨울(1월)에는 패딩이 후보다', () => {
    const t = typesOn('2026-01-15', [8, 8])
    expect(t.includes('패딩') || t.includes('코트')).toBe(true)
  })

  it('10월에도 판단 기온이 아주 낮으면(3℃) 철과 상관없이 패딩을 허용한다', () => {
    const only = [cloth('SWEATSHIRT', 'GRAY'), cloth('PANTS', 'BLUE'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
    expect(runOn(only, '2026-10-20', [3, 3]).items.map((i) => i.type)).toContain('패딩')
  })

  it('봄·여름(5월·7월)에는 쌀쌀해도 패딩·코트를 쓰지 않는다', () => {
    for (const date of ['2026-05-10', '2026-07-10']) for (const seed of [undefined, ...days.slice(0, 3)]) expect(typesOn(date, [8, 8], seed)).not.toEqual(expect.arrayContaining(['패딩']))
    expect(typesOn('2026-07-10', [10, 10])).not.toContain('코트')
  })

  it('낮 기온이 따뜻하면(최고 18℃) 저녁이 추워도 패딩은 쓰지 않는다 (코트는 가능)', () => {
    // 낮 18℃ → 밤 3℃: 판단 기온은 꽤 낮지만 낮에 패딩은 과하다
    for (const seed of [undefined, ...days.slice(0, 4)]) expect(typesOn('2026-01-15', [18, 12, 3], seed)).not.toContain('패딩')
  })

  it('낮 최고가 12℃인 한겨울날에는 패딩이 후보다', () => {
    const only = [cloth('SWEATSHIRT', 'GRAY'), cloth('PANTS', 'BLUE'), cloth('PADDING', 'BLACK', 'THICK', { windproof: true })]
    expect(runOn(only, '2026-01-15', [12, 6, 2]).items.map((i) => i.type)).toContain('패딩')
  })

  it('낮 최고가 22℃ 넘으면 코트도 쓰지 않는다', () => {
    for (const seed of [undefined, ...days.slice(0, 3)]) expect(typesOn('2026-04-10', [22, 10, 8], seed)).not.toContain('코트')
  })
})

describe('며칠짜리 일정: 앞선 날 입은 옷을 피해서 고른다', () => {
  const runAvoid = (avoidIds: string[], seed: string) =>
    recommend({ points: pts(20), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: 'TRAVEL', clothes: wardrobe, airGrade: 2, varietySeed: seed, avoidIds } as EngineInput)

  it('사흘 동안 상의가 겹치지 않는다(상의가 충분하면)', () => {
    const used: string[] = []
    const topsWorn: string[] = []
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12']) {
      const r = runAvoid(used, `u1:e1:${d}`)
      topsWorn.push(r.items[0]!.clothingId!)
      for (const it of r.items) if (it.clothingId) used.push(it.clothingId)
      expect(r.insufficientWardrobe).toBe(false)
    }
    expect(new Set(topsWorn).size).toBe(3)
  })

  it('조합마다 이유(comboWhy)가 items + alternatives 개수만큼 있다', () => {
    const r = run(wardrobe, 20, 'u1:2026-10-05')
    expect(r.comboWhy).toHaveLength(1 + r.alternatives.length)
    for (const w of r.comboWhy) expect(w.notes.length).toBeGreaterThan(0)
  })
})
