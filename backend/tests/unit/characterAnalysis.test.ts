import { describe, expect, it } from 'vitest'
import type { ClothingColor, ClothingPattern, ClothingType } from '@prisma/client'
import { analyze, MIN_CLOTHES, TITLES, type ClothesForAnalysis } from '../../src/services/character/analysis.js'
import { CATALOG, cleanConfig } from '../../src/services/character/catalog.js'

const c = (type: ClothingType, color: ClothingColor, pattern: ClothingPattern = 'SOLID'): ClothesForAnalysis => ({ type, color, pattern })
const many = (n: number, f: (i: number) => ClothesForAnalysis) => Array.from({ length: n }, (_, i) => f(i))
const titleOf = (items: ClothesForAnalysis[]) => analyze(items).title?.key

describe('옷장 분석: 칭호', () => {
  it(`옷이 ${MIN_CLOTHES}벌 미만이면 칭호를 주지 않고 몇 벌 더 담으라고 알려준다`, () => {
    const a = analyze(many(MIN_CLOTHES - 2, () => c('HOODIE', 'BLACK')))
    expect(a.ready).toBe(false)
    expect(a.title).toBeNull()
    expect(a.need).toBe(2)
    expect(analyze([]).count).toBe(0)
  })

  it('어둠의 아이: 검정이 절반 이상', () => {
    expect(titleOf([...many(5, (i) => c(i % 2 ? 'SHORT_SLEEVE' : 'PANTS', 'BLACK')), ...many(5, () => c('LONG_SLEEVE', 'BLUE'))])).toBe('DARK_CHILD')
    expect(titleOf([...many(4, () => c('PANTS', 'BLACK')), ...many(6, () => c('LONG_SLEEVE', 'BLUE'))])).not.toBe('DARK_CHILD') // 40%
  })

  it('무채색 미니멀리스트: 검정·회색·흰색 80% 이상 + 무지 대부분 (검정 절반 미만일 때)', () => {
    const items = [c('PANTS', 'BLACK'), c('LONG_SLEEVE', 'WHITE'), c('SWEATSHIRT', 'GRAY'), c('SHORT_SLEEVE', 'WHITE'), c('PANTS', 'GRAY'), c('KNIT', 'GRAY')]
    expect(titleOf(items)).toBe('MINIMALIST')
  })

  it('무늬가 많으면 무채색이라도 미니멀리스트가 아니다 (패턴 장인)', () => {
    const items = many(10, (i) => c('LONG_SLEEVE', i % 2 ? 'WHITE' : 'GRAY', i < 5 ? 'STRIPE' : 'SOLID'))
    expect(titleOf(items)).toBe('PATTERN_MASTER')
  })

  it('패턴 장인: 무늬 있는 옷이 40% 이상', () => {
    expect(titleOf(many(10, (i) => c('SHIRT', 'BLUE', i < 4 ? 'CHECK' : 'SOLID')))).toBe('PATTERN_MASTER')
  })

  it('파스텔 요정: 분홍·하늘·베이지 40% 이상', () => {
    expect(titleOf(many(10, (i) => c('LONG_SLEEVE', i < 4 ? 'PINK' : 'GREEN')))).toBe('PASTEL_FAIRY')
    expect(titleOf([c('SKIRT', 'BEIGE'), c('KNIT', 'SKYBLUE'), c('SHIRT', 'PINK'), c('PANTS', 'BLUE'), c('JACKET', 'GREEN')])).toBe('PASTEL_FAIRY')
  })

  it('후드티 중독자: 후드티 25% 이상이고 3벌 이상', () => {
    expect(titleOf(many(8, (i) => c(i < 3 ? 'HOODIE' : 'PANTS', i < 3 ? 'GREEN' : 'BLUE')))).toBe('HOODIE_ADDICT')
    expect(titleOf([c('HOODIE', 'GREEN'), c('HOODIE', 'GREEN'), c('PANTS', 'BLUE'), c('LONG_SLEEVE', 'RED'), c('SHIRT', 'YELLOW')])).not.toBe('HOODIE_ADDICT') // 2벌
  })

  it('따뜻한 곰: 니트·패딩·코트 35% 이상', () => {
    expect(titleOf(many(10, (i) => c(i < 2 ? 'KNIT' : i < 3 ? 'PADDING' : i < 4 ? 'COAT' : 'PANTS', 'BROWN')))).toBe('WARM_BEAR')
  })

  it('반팔 한 장 인간: 반팔과 반바지가 절반 이상', () => {
    expect(titleOf(many(10, (i) => c(i < 5 ? 'SHORT_SLEEVE' : i < 7 ? 'SHORTS' : 'PANTS', 'ORANGE')))).toBe('TEE_ONLY')
  })

  it('어느 쪽도 아니면 균형 잡힌 옷장', () => {
    const items = [c('SHORT_SLEEVE', 'RED'), c('PANTS', 'BLUE'), c('JACKET', 'GREEN'), c('KNIT', 'ORANGE'), c('SKIRT', 'YELLOW'), c('SHIRT', 'PURPLE')]
    expect(titleOf(items)).toBe('BALANCED')
  })

  it('조건이 여럿 맞으면 더 강하게 맞은 칭호가 이긴다', () => {
    // 검정 100% (어둠의 아이 점수 2.0) vs 무채색(1.25)
    expect(titleOf(many(8, () => c('PANTS', 'BLACK')))).toBe('DARK_CHILD')
  })

  it('예시 옷은 분석에 넣지 않는다 (서버가 isSample 을 걸러서 넘긴다)는 가정 아래, 비중 합은 1이다', () => {
    const a = analyze(many(7, (i) => c(i % 2 ? 'PANTS' : 'KNIT', i % 3 ? 'BLACK' : 'WHITE')))
    for (const list of [a.colors, a.types, a.patterns]) expect(list.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 5)
    expect(a.colors[0]!.share).toBeGreaterThanOrEqual(a.colors[a.colors.length - 1]!.share)
  })

  it('칭호 목록에는 모두 이름·한 줄 문구·받는 조건이 있다', () => {
    for (const t of TITLES) expect(t.name && t.tagline && t.rule).toBeTruthy()
    expect(new Set(TITLES.map((t) => t.key)).size).toBe(TITLES.length)
  })
})

describe('꾸미기 카탈로그', () => {
  it('카탈로그에 있는 값만 남기고 나머지는 버린다', () => {
    expect(cleanConfig({ hat: 'beanie', glasses: 'nope', hairpin: 'ribbon', extra: 5, foo: 'x' })).toEqual({ hat: 'beanie', hairpin: 'ribbon' })
    expect(cleanConfig(null)).toEqual({})
    expect(cleanConfig('x')).toEqual({})
  })
  it('슬롯마다 아이템이 있고 id 가 겹치지 않는다', () => {
    for (const s of CATALOG) {
      expect(s.items.length).toBeGreaterThan(0)
      expect(new Set(s.items.map((i) => i.id)).size).toBe(s.items.length)
    }
  })
})
