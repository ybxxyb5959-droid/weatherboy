import { describe, expect, it } from 'vitest'
import type { ClothingColor, ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { analyze as analyzeWith, MIN_CLOTHES, TITLES, tasteOf, type ClothesForAnalysis, type TitleKey } from '../../src/services/character/analysis.js'
import { CATALOG, cleanConfig } from '../../src/services/character/catalog.js'

// 칭호 규칙을 시험하는 옷장은 5~10벌 안팎으로 만들어져 있어서, 규칙 시험에서는 열리는 기준을 5벌로 두고 본다.
// 실제 열리는 기준(MIN_CLOTHES)은 아래 '캐릭터가 열리는 기준' 시험에서 따로 확인한다.
const RULE_TEST_MIN = 5
const analyze = (items: ClothesForAnalysis[]) => analyzeWith(items, RULE_TEST_MIN)
const c = (type: ClothingType, color: ClothingColor, pattern: ClothingPattern = 'SOLID', thickness: Thickness = 'NORMAL'): ClothesForAnalysis => ({ type, color, pattern, thickness })
const many = (n: number, f: (i: number) => ClothesForAnalysis) => Array.from({ length: n }, (_, i) => f(i))
const MIX: ClothingColor[] = ['GREEN', 'PURPLE', 'RED', 'GREEN', 'PURPLE']
const base = (n = 10) => many(n, (i) => c('PANTS', MIX[i % MIX.length]!))
const mixedType = (type: ClothingType, number: number) => base().map((x, i) => i < number ? { ...x, type } : x)
const mixedColor = (color: ClothingColor, number: number) => base().map((x, i) => i < number ? { ...x, color } : x)
const qualifies = (items: ClothesForAnalysis[], key: TitleKey) => analyze(items).matchedTitles.some((t) => t.key === key)
const rainbowColors: ClothingColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'PINK', 'ORANGE', 'BROWN']
const rainbow = rainbowColors.map((color, i) => c(i % 2 ? 'PANTS' : 'LONG_SLEEVE', color))

const boundaryCases: { key: TitleKey; yes: ClothesForAnalysis[]; no: ClothesForAnalysis[] }[] = [
  { key: 'DARK_CHILD', yes: mixedColor('BLACK', 5), no: mixedColor('BLACK', 4) },
  { key: 'MINIMALIST', yes: base().map((x, i) => i < 7 ? { ...x, color: i % 2 ? 'WHITE' : 'GRAY' } : x), no: base().map((x, i) => i < 6 ? { ...x, color: i % 2 ? 'WHITE' : 'GRAY' } : x) },
  { key: 'PATTERN_MASTER', yes: base().map((x, i) => ({ ...x, pattern: i < 5 ? 'CHECK' : 'SOLID' })), no: base().map((x, i) => ({ ...x, pattern: i < 4 ? 'CHECK' : 'SOLID' })) },
  { key: 'PASTEL_FAIRY', yes: base().map((x, i) => ({ ...x, color: i < 3 ? 'PINK' : i < 5 ? 'BEIGE' : x.color })), no: base().map((x, i) => ({ ...x, color: i < 2 ? 'PINK' : i < 5 ? 'BEIGE' : x.color })) },
  { key: 'HOODIE_ADDICT', yes: mixedType('HOODIE', 4), no: mixedType('HOODIE', 3) },
  { key: 'WARM_BEAR', yes: mixedType('KNIT', 4), no: mixedType('KNIT', 3) },
  { key: 'TEE_ONLY', yes: mixedType('SHORT_SLEEVE', 5), no: mixedType('SHORT_SLEEVE', 4) },
  { key: 'OUTER_FAN', yes: mixedType('JACKET', 4), no: mixedType('JACKET', 3) },
  { key: 'SHIRT_GENTLE', yes: mixedType('SHIRT', 4), no: mixedType('SHIRT', 3) },
  { key: 'SKIRT_LOVER', yes: mixedType('SKIRT', 4), no: mixedType('SKIRT', 3) },
  { key: 'EARTH_TONE', yes: mixedColor('BROWN', 5), no: mixedColor('BROWN', 4) },
  { key: 'BLUE_SEA', yes: mixedColor('NAVY', 5), no: mixedColor('NAVY', 4) },
  { key: 'VITAMIN', yes: many(10, (i) => c('PANTS', i < 5 ? 'YELLOW' : 'PURPLE')), no: many(10, (i) => c('PANTS', i < 4 ? 'YELLOW' : 'PURPLE')) },
  { key: 'RAINBOW', yes: rainbow, no: rainbow.slice(0, 6) },
  { key: 'COLOR_LOVER', yes: mixedColor('GREEN', 6), no: base() },
]

describe('15개 칭호: 충족 조건과 경계', () => {
  it.each(boundaryCases)('$key: 조건을 채운 옷장만 통과한다', ({ key, yes, no }) => {
    expect(qualifies(yes, key)).toBe(true)
    expect(qualifies(no, key)).toBe(false)
  })
  it('옷이 열리는 기준 미만이면 주·부칭호와 충족 목록·힌트가 모두 비어 있다', () => {
    for (let n = 0; n < MIN_CLOTHES; n++) {
      expect(analyzeWith(many(n, () => c('HOODIE', 'BLACK')))).toMatchObject({ count: n, ready: false, need: MIN_CLOTHES - n, title: null, subTitle: null, matchedTitles: [], next: null, strength: 0 })
    }
  })
  it.each(['HOODIE', 'SHIRT', 'SKIRT'] as ClothingType[])('%s는 2벌로 칭호를 받지 못한다', (type) => {
    const key = { HOODIE: 'HOODIE_ADDICT', SHIRT: 'SHIRT_GENTLE', SKIRT: 'SKIRT_LOVER' }[type as 'HOODIE' | 'SHIRT' | 'SKIRT'] as TitleKey
    expect(qualifies([c(type, 'GREEN'), c(type, 'RED'), ...base(3)], key)).toBe(false)
    expect(qualifies([c(type, 'GREEN'), c(type, 'RED'), c(type, 'PURPLE'), ...base(2)], key)).toBe(true)
  })
  it('도감의 15개 이름·순서·조건이 유지되고 실제 판정 수치가 문구에 나온다', () => {
    expect(TITLES).toHaveLength(15)
    expect(new Set(TITLES.map((t) => t.key)).size).toBe(15)
    expect(TITLES[0]?.key).toBe('DARK_CHILD')
    expect(TITLES.at(-1)?.key).toBe('COLOR_LOVER')
    for (const t of TITLES) expect(t.name && t.tagline && t.rule).toBeTruthy()
    expect(TITLES.find((t) => t.key === 'DARK_CHILD')?.rule).toContain('50% 이상')
    expect(TITLES.find((t) => t.key === 'SKIRT_LOVER')?.rule).toContain('3벌 이상')
  })
  it('5~500벌에서 검정 50% 경계를 반올림 없이 판정한다', () => {
    for (const n of [5, 6, 7, 9, 10, 11, 99, 100, 499, 500]) {
      const minimum = Math.ceil(n / 2)
      const items = (m: number) => many(n, (i) => c('PANTS', i < m ? 'BLACK' : MIX[i % MIX.length]!))
      expect(qualifies(items(minimum), 'DARK_CHILD')).toBe(true)
      expect(qualifies(items(minimum - 1), 'DARK_CHILD')).toBe(false)
    }
  })
})

describe('납득하기 어려웠던 옷장 회귀 사례', () => {
  it('기타색 바지만 있어도 꾸미기는 열리지만 칭호를 억지로 붙이지 않는다', () => {
    expect(analyze(many(5, () => c('PANTS', 'OTHER')))).toMatchObject({ ready: true, need: 0, title: null, subTitle: null, matchedTitles: [] })
  })
  it('무채색 80%와 무지 80%가 각각 있어도 같은 옷이 아니면 미니멀리스트가 아니다', () => {
    const items = base().map((x, i) => ({ ...x, color: i < 8 ? 'GRAY' as const : x.color, pattern: i < 2 ? 'CHECK' as const : 'SOLID' as const }))
    expect(qualifies(items, 'MINIMALIST')).toBe(false)
  })
  it('베이지 한 색만 있으면 파스텔 요정이 아니다', () => {
    const a = analyze(many(6, () => c('PANTS', 'BEIGE')))
    expect(a.matchedTitles.map((t) => t.key)).not.toContain('PASTEL_FAIRY')
    expect(a.title?.key).toBe('COLOR_LOVER')
  })
  it('반바지만 있어도 반팔 한 장 인간이 되지 않는다', () => {
    expect(qualifies(many(6, (i) => c('SHORTS', MIX[i % MIX.length]!)), 'TEE_ONLY')).toBe(false)
  })
  it('반팔셔츠는 반팔 상의이면서 셔츠로도 인정된다', () => {
    const keys = analyze(mixedType('SHORT_SLEEVE_SHIRT', 6)).matchedTitles.map((t) => t.key)
    expect(keys).toContain('TEE_ONLY')
    expect(keys).toContain('SHIRT_GENTLE')
  })
  it('얇은 니트·코트·패딩은 따뜻한 곰 근거로 쓰지 않는다', () => {
    expect(qualifies(mixedType('KNIT', 5).map((x) => ({ ...x, thickness: 'THIN' })), 'WARM_BEAR')).toBe(false)
  })
  it.each(['BLACK', 'WHITE', 'GRAY', 'OTHER'] as ClothingColor[])('%s만 있는 옷장은 유채색 한 색 칭호 대상이 아니다', (color) => {
    expect(qualifies(many(6, () => c('PANTS', color)), 'COLOR_LOVER')).toBe(false)
  })
  it('흰색 무지 옷장은 단색 칭호 대신 미니멀리스트로 설명한다', () => {
    expect(analyze(many(6, () => c('PANTS', 'WHITE'))).title?.key).toBe('MINIMALIST')
  })
  it('무지개는 무채색·기타를 7가지 색 수에 끼워 넣지 않는다', () => {
    const colors: ClothingColor[] = ['BLACK', 'WHITE', 'GRAY', 'GREEN', 'PURPLE', 'OTHER']
    expect(qualifies(colors.map((color) => c('PANTS', color)), 'RAINBOW')).toBe(false)
  })
  it('무지개는 7색이어도 한 색이 30%를 넘거나 유채색이 80% 미만이면 안 된다', () => {
    expect(qualifies([...rainbow.slice(0, 7), ...many(4, () => c('PANTS', 'RED'))], 'RAINBOW')).toBe(false)
    expect(qualifies([...rainbow.slice(0, 7), c('PANTS', 'BLACK'), c('PANTS', 'GRAY'), c('PANTS', 'OTHER')], 'RAINBOW')).toBe(false)
  })
  it('무지개의 한 색 30%와 유채색 80%는 정확한 경계에서도 인정된다', () => {
    expect(qualifies([...rainbow.slice(0, 7), c('PANTS', 'RED'), c('PANTS', 'BLACK'), c('PANTS', 'GRAY')], 'RAINBOW')).toBe(true)
  })
})


describe('칭호 선정과 설명', () => {
  it('치마 비중이 50%여도 검정 80%보다 과대평가하지 않는다', () => {
    const items = many(10, (i) => c(i < 5 ? 'SKIRT' : 'PANTS', i < 8 ? 'BLACK' : 'GREEN', 'CHECK'))
    const a = analyze(items)
    expect(a.title?.key).toBe('PATTERN_MASTER') // 실제 비중: 무늬 100%, 검정 80%, 치마 50%
    expect(a.subTitle?.key).toBe('DARK_CHILD')
    expect(a.matchedTitles.map((t) => t.key)).toEqual(['PATTERN_MASTER', 'DARK_CHILD', 'SKIRT_LOVER'])
  })
  it('검정 무지 옷만 있으면 어둠의 아이가 미니멀리스트보다 먼저다', () => {
    const a = analyze(many(8, () => c('PANTS', 'BLACK')))
    expect(a.title?.key).toBe('DARK_CHILD')
    expect(a.subTitle?.key).toBe('MINIMALIST')
  })
  it('검정 후드티 6벌은 후드티·검정·미니멀리스트 조건을 모두 기록한다', () => {
    const a = analyze(many(6, () => c('HOODIE', 'BLACK')))
    expect(a.title?.key).toBe('HOODIE_ADDICT')
    expect(a.subTitle?.key).toBe('DARK_CHILD')
    expect(a.matchedTitles.map((t) => t.key)).toEqual(['HOODIE_ADDICT', 'DARK_CHILD', 'MINIMALIST'])
    expect(a.title?.reason).toContain('6/6벌(100%)')
  })
  it('실제 선호 색과 벌수로 칭호 근거를 설명한다', () => {
    const a = analyze(many(10, (i) => c('PANTS', i < 6 ? 'GREEN' : 'PURPLE')))
    expect(a.title?.key).toBe('COLOR_LOVER')
    expect(a.title?.tagline).toBe('초록 아니면 안 돼')
    expect(a.title?.reason).toBe('초록 옷 6/10벌(60%)')
  })
  it('옷 입력 순서가 바뀌어도 결과와 근거가 같다', () => {
    const a = analyze(rainbow)
    const b = analyze([...rainbow].reverse())
    expect(b).toEqual(a)
  })
  it('삭제에 해당하는 옷 제외 후 열리는 기준 미만이면 다시 잠긴다', () => {
    const items = many(MIN_CLOTHES, () => c('HOODIE', 'BLACK'))
    expect(analyzeWith(items).ready).toBe(true)
    expect(analyzeWith(items.slice(1))).toMatchObject({ ready: false, title: null, matchedTitles: [] })
  })
  it('색상·종류·무늬 비중의 합은 1이며 빈 옷장에는 NaN이 없다', () => {
    for (const list of [analyze(rainbow).colors, analyze(rainbow).types, analyze(rainbow).patterns]) {
      expect(list.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10)
    }
    expect(analyze([]).colors).toEqual([])
  })
})

describe('취향 칭호: 희귀 칭호가 없을 때 옷장의 가장 두드러진 특징으로 만든다', () => {
  // 어느 희귀 칭호에도 안 걸리는 평범한 옷장(색·종류가 흩어져 있고 한 색이 2벌만)
  const plainCloset = () => [c('LONG_SLEEVE', 'BLACK'), c('SHORT_SLEEVE', 'WHITE'), c('SWEATSHIRT', 'GRAY'), c('PANTS', 'NAVY'), c('PANTS', 'BEIGE'), c('SHORTS', 'BLUE'), c('SHIRT', 'SKYBLUE'), c('KNIT', 'BROWN'), c('JACKET', 'KHAKI'), c('CARDIGAN', 'RED'), c('PANTS', 'GREEN')]
  // 종류는 최대 2벌, 색은 모두 다른 10벌에서, 앞쪽 몇 벌만 한 가지 특징을 갖게 만든다
  const spreadTypes: ClothingType[] = ['LONG_SLEEVE', 'SHORT_SLEEVE', 'SWEATSHIRT', 'PANTS', 'PANTS', 'SHORTS', 'SHIRT', 'KNIT', 'JACKET', 'CARDIGAN']
  const spreadColors: ClothingColor[] = ['BLACK', 'WHITE', 'GRAY', 'NAVY', 'BEIGE', 'BLUE', 'SKYBLUE', 'BROWN', 'KHAKI', 'GREEN']
  const spread = (f: (i: number) => { color?: ClothingColor; pattern?: ClothingPattern }) => spreadTypes.map((t, i) => c(t, f(i).color ?? spreadColors[i]!, f(i).pattern ?? 'SOLID'))
  it('희귀 칭호가 있으면 취향 칭호는 붙지 않는다', () => {
    const a = analyzeWith(many(10, () => c('HOODIE', 'BLACK')))
    expect(a.title).not.toBeNull()
    expect(a.taste).toBeNull()
  })
  it('옷이 열리는 기준 미만이면 취향 칭호도 없다', () => {
    expect(analyzeWith(many(MIN_CLOTHES - 1, (i) => c('PANTS', i % 2 ? 'BLACK' : 'WHITE'))).taste).toBeNull()
  })
  it('평범한 옷장도 열리면 가장 두드러진 특징으로 취향 칭호를 받는다', () => {
    const a = analyzeWith(plainCloset())
    expect(a).toMatchObject({ ready: true, title: null })
    expect(a.taste).toMatchObject({ key: 'TASTE', name: '바지 단골' })
    expect(a.taste?.reason).toBe('바지 3/11벌(27.2%)')
  })
  it('색이 가장 두드러지면 "○○ 편애 중"이 된다', () => {
    const a = analyzeWith(spread((i) => ({ color: i < 3 ? 'GRAY' : undefined })))
    expect(a.title).toBeNull()
    expect(a.taste).toMatchObject({ name: '회색 편애 중', tagline: '자꾸 손이 가는 회색' })
    expect(a.taste?.reason).toBe('회색 옷 3/10벌(30%)')
  })
  it('무늬가 가장 두드러지면 "○○ 포인트"가 된다', () => {
    const a = analyzeWith(spread((i) => ({ pattern: i < 3 ? 'STRIPE' : undefined })))
    expect(a.title).toBeNull()
    expect(a.taste?.name).toBe('줄무늬 포인트')
  })
  it('기타 색과 무지는 특징으로 세지 않고, 같은 특징이 2벌 미만이면 만들지 않는다', () => {
    expect(tasteOf(many(4, (i) => c(['LONG_SLEEVE', 'SHORT_SLEEVE', 'SHIRT', 'KNIT'][i] as ClothingType, 'OTHER')))).toBeNull()
  })
  it('옷 입력 순서가 바뀌어도 같은 취향 칭호가 나온다', () => {
    expect(analyzeWith([...plainCloset()].reverse()).taste).toEqual(analyzeWith(plainCloset()).taste)
  })
})

describe('다음 칭호: 추가한 예시 옷으로 실제 화면에 표시되는지 검증', () => {
  it('후드티 2벌/5벌은 초록 무지 후드티 1벌 추가 후 주칭호로 표시된다', () => {
    const items = [c('HOODIE', 'GREEN'), c('HOODIE', 'PURPLE'), c('PANTS', 'RED'), c('PANTS', 'GREEN'), c('PANTS', 'PURPLE')]
    const a = analyze(items)
    expect(a.next).toMatchObject({ title: { key: 'HOODIE_ADDICT' }, more: 1, what: '초록 무지 후드티(두께 보통)' })
    expect(analyze([...items, c('HOODIE', 'GREEN')]).title?.key).toBe('HOODIE_ADDICT')
  })
  it('후드티 3벌이 되어도 50% 미만이면 후드티 1벌로 된다는 힌트를 주지 않는다', () => {
    const items = many(10, (i) => c(i < 2 ? 'HOODIE' : 'PANTS', 'BLACK', 'CHECK'))
    const a = analyze(items)
    expect(a.next?.title.key === 'HOODIE_ADDICT' && a.next.more === 1).toBe(false)
    expect(qualifies([...items, c('HOODIE', 'GREEN')], 'HOODIE_ADDICT')).toBe(false)
  })
  it('조건은 충족해도 세 번째로 밀리는 칭호를 다음 주/부칭호라고 하지 않는다', () => {
    const items = many(5, (i) => c(i < 2 ? 'HOODIE' : 'PANTS', 'BLACK', 'CHECK'))
    expect(qualifies([...items, c('HOODIE', 'GREEN')], 'HOODIE_ADDICT')).toBe(true)
    expect(analyze([...items, c('HOODIE', 'GREEN')]).matchedTitles[2]?.key).toBe('HOODIE_ADDICT')
    const next = analyze(items).next
    expect(next?.title.key === 'HOODIE_ADDICT' && next.more === 1).toBe(false)
    expect(next).not.toBeNull()
    expect(analyze([...items, ...many(next!.more, () => next!.example)]).matchedTitles.slice(0, 2).map((t) => t.key)).toContain(next!.title.key)
  })
  it('500벌 상한에서는 더 등록하라는 힌트를 주지 않는다', () => {
    expect(analyze(base(500)).next).toBeNull()
  })
})

describe('꾸미기 카탈로그', () => {
  it('카탈로그에 있는 값만 남기고 나머지는 버린다', () => {
    expect(cleanConfig({ hat: 'beanie', glasses: 'nope', hairpin: 'ribbon', extra: 5, foo: 'x' })).toEqual({ hat: 'beanie', hairpin: 'ribbon' })
    expect(cleanConfig(null)).toEqual({})
    expect(cleanConfig('x')).toEqual({})
  })
  it('슬롯마다 아이템이 있고 id가 겹치지 않는다', () => {
    for (const s of CATALOG) {
      expect(s.items.length).toBeGreaterThan(0)
      expect(new Set(s.items.map((i) => i.id)).size).toBe(s.items.length)
    }
  })
})

describe('캐릭터가 열리는 기준', () => {
  it('내 옷이 10벌 이상이어야 열린다', () => {
    expect(MIN_CLOTHES).toBe(10)
    expect(analyzeWith(many(9, () => c('PANTS', 'BLACK')))).toMatchObject({ ready: false, need: 1 })
    expect(analyzeWith(many(10, () => c('PANTS', 'BLACK')))).toMatchObject({ ready: true, need: 0 })
  })
})
