import { describe, expect, it } from 'vitest'
import type { ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { colorIssueOf, comboColorScore, pairScore } from '../../src/rules/colorHarmony.js'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { deriveClothing } from '../../src/rules/clothing.js'

const c = (color: string, pattern?: ClothingPattern) => ({ color, pattern })

describe('pairScore', () => {
  it('같은 쨍한 색(파랑+파랑)은 감점, 무채색 한 벌 룩은 감점하지 않는다', () => {
    expect(pairScore(c('BLUE'), c('BLUE'))).toBe(-2)
    expect(pairScore(c('BLACK'), c('BLACK'))).toBe(0)
    expect(pairScore(c('WHITE'), c('WHITE'))).toBe(0)
  })
  it('무채색 + 포인트색이 가장 안전하다', () => {
    expect(pairScore(c('WHITE'), c('BLUE'))).toBe(2)
    expect(pairScore(c('RED'), c('BLACK'))).toBe(2)
  })
  it('네이비+하늘색은 톤온톤이라 좋고, 파랑 계열끼리는 감점하지 않는다', () => {
    expect(pairScore(c('NAVY'), c('SKYBLUE'))).toBe(1)
    expect(pairScore(c('BLUE'), c('SKYBLUE'))).toBe(0)
  })
  it('쨍한 색끼리는 기본 감점, 크게 부딪히는 짝은 더 감점, 무난한 짝은 0', () => {
    expect(pairScore(c('RED'), c('GREEN'))).toBe(-3)
    expect(pairScore(c('PINK'), c('ORANGE'))).toBe(-3)
    expect(pairScore(c('YELLOW'), c('PINK'))).toBe(-1)
    expect(pairScore(c('SKYBLUE'), c('PINK'))).toBe(0)
  })
  it('카키+초록은 어색하다', () => expect(pairScore(c('KHAKI'), c('GREEN'))).toBe(-1))
  it('순서와 상관없다', () => expect(pairScore(c('GREEN'), c('RED'))).toBe(pairScore(c('RED'), c('GREEN'))))
  it('무늬가 겹치면 감점, 무늬 + 무채색은 괜찮다', () => {
    expect(pairScore(c('GRAY', 'STRIPE'), c('BLACK', 'CHECK'))).toBe(-1) // 1(무채색끼리) - 2
    expect(pairScore(c('GRAY', 'STRIPE'), c('BLACK', 'SOLID'))).toBe(1)
    expect(pairScore(c('RED', 'DOT'), c('WHITE'))).toBe(2)
  })
  it('색을 모르는 옷(기타)은 판단하지 않는다', () => expect(pairScore(c('OTHER'), c('BLUE'))).toBe(0))
})

describe('colorIssueOf / comboColorScore', () => {
  it('유형을 가려낸다', () => {
    expect(colorIssueOf(c('BLUE'), c('BLUE'))).toBe('MONO')
    expect(colorIssueOf(c('RED'), c('GREEN'))).toBe('CLASH')
    expect(colorIssueOf(c('GRAY', 'STRIPE'), c('BLACK', 'CHECK'))).toBe('PATTERN')
    expect(colorIssueOf(c('WHITE'), c('BLUE'))).toBeNull()
    expect(colorIssueOf(c('BLACK'), c('BLACK'))).toBeNull()
  })
  it('겉옷은 상/하의와의 궁합을 절반씩 센다', () => {
    expect(comboColorScore(c('WHITE'), c('BLUE'), null)).toBe(2)
    expect(comboColorScore(c('WHITE'), c('BLUE'), c('BEIGE'))).toBe(2 + 0.5 * 1 + 0.5 * 2)
  })
})

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL', pattern: ClothingPattern = 'SOLID'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `h${String(++seq).padStart(3, '0')}`, type, thickness, color, pattern, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const pts = (temp: number): OutingPoint[] => [
  { at: new Date('2026-10-02T00:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
  { at: new Date('2026-10-02T06:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
]
const run = (clothes: WardrobeItem[], seed: string) =>
  recommend({ points: pts(25), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed } as EngineInput)

describe('추천에서의 색 보정', () => {
  // 25도: 반팔 + 긴바지 같은 보온이 같은 후보 여러 개
  const blueTee = cloth('SHORT_SLEEVE', 'BLUE')
  const whiteTee = cloth('SHORT_SLEEVE', 'WHITE')
  const bluePants = cloth('PANTS', 'BLUE')

  it('파랑 바지가 있어도 파랑 티 대신 흰 티를 고른다(날짜가 달라져도)', () => {
    for (let d = 1; d <= 20; d++) {
      const r = run([blueTee, whiteTee, bluePants], `u:2026-10-${String(d).padStart(2, '0')}`)
      expect(r.items.map((i) => i.clothingId)).toEqual([whiteTee.id, bluePants.id])
      expect(r.colorIssue).toBeNull()
    }
  })

  it('다른 선택지가 없으면 그대로 추천하되 색 문제와 보완 팁을 알려준다', () => {
    const r = run([blueTee, bluePants], 'u:2026-10-02')
    expect(r.items.map((i) => i.clothingId)).toEqual([blueTee.id, bluePants.id])
    expect(r.colorIssue).toBe('MONO')
    expect(r.comboWhy[0]!.notes.join(' ')).toContain('같은 색')
  })

  it('색 때문에 날씨에 맞지 않는 옷을 고르지는 않는다(보온 조건이 먼저)', () => {
    const warmBlue = cloth('KNIT', 'BLUE', 'THICK')
    const warmBluePants = cloth('PANTS', 'BLUE')
    const lightWhite = cloth('SHORT_SLEEVE', 'WHITE', 'THIN')
    const r = recommend({ points: pts(8), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: [warmBlue, warmBluePants, lightWhite, cloth('COAT', 'BLACK', 'THICK')], airGrade: 2, varietySeed: 'u:2026-12-01' } as EngineInput)
    expect(r.items.map((i) => i.clothingId)).not.toContain(lightWhite.id)
  })

  it('다른 조합 보기에서는 색이 어색한 조합을 뒤로 보낸다', () => {
    const grayPants = cloth('PANTS', 'GRAY')
    const r = run([blueTee, whiteTee, bluePants, grayPants], 'u:2026-10-02')
    const labels = r.alternatives.map((a) => a.map((i) => i.label).join('+'))
    const monoIdx = labels.findIndex((l) => l === '파랑 반팔+파랑 바지')
    expect(monoIdx).toBe(labels.length - 1)
  })

  it('색 정보가 없는 일반 추천은 색 판단을 하지 않는다', () => {
    const r = recommend({ points: pts(25), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: [], airGrade: 2 } as EngineInput)
    expect(r.colorIssue).toBeNull()
  })
})
