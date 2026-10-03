import { describe, expect, it } from 'vitest'
import type { ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { comboTaboo, pieceTaboo, situationOf, stylistApplicable, styleGapHint } from '../../src/rules/outfitStyle.js'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { deriveClothing } from '../../src/rules/clothing.js'

describe('situationOf: 제목으로 자리를 알아낸다', () => {
  it.each([
    ['다음주 면접', 'INTERVIEW'], ['팀 발표', 'INTERVIEW'], ['임원 미팅', 'INTERVIEW'],
    ['친구 결혼식', 'WEDDING'], ['웨딩 하객', 'WEDDING'],
    ['할머니 장례식', 'FUNERAL'], ['조문', 'FUNERAL'],
    ['소개팅', 'DATE'], ['데이트', 'DATE'],
  ] as const)('%s -> %s', (t, s) => expect(situationOf(t)).toBe(s))
  it.each(['제주 여행', '북한산 등산', '시험', '출근', '결혼기념일 저녁', 'PT 받기', ''])('특별한 자리가 아니다: "%s"', (t) => expect(situationOf(t)).toBeNull())
  it('장례처럼 틀리면 곤란한 자리를 먼저 본다', () => expect(situationOf('결혼식 다음날 장례')).toBe('FUNERAL'))
})

const piece = (type: ClothingType, color = 'GRAY', pattern?: ClothingPattern) => ({ type, color, pattern })
describe('pieceTaboo / comboTaboo', () => {
  it('면접: 후드티·반바지·프린트는 감점, 셔츠는 무난', () => {
    expect(pieceTaboo('INTERVIEW', { ...piece('HOODIE'), role: 'top' }).score).toBe(-6)
    expect(pieceTaboo('INTERVIEW', { ...piece('SHORTS'), role: 'bottom' }).score).toBe(-6)
    expect(pieceTaboo('INTERVIEW', { ...piece('SHIRT', 'WHITE', 'PRINT'), role: 'top' }).score).toBe(-4)
    expect(pieceTaboo('INTERVIEW', { ...piece('SHIRT', 'WHITE'), role: 'top' }).score).toBe(0)
  })
  it('결혼식: 흰색 상의/겉옷은 감점이지만 흰 바지는 아니다', () => {
    expect(pieceTaboo('WEDDING', { ...piece('SHIRT', 'WHITE'), role: 'top' }).score).toBe(-6)
    expect(pieceTaboo('WEDDING', { ...piece('JACKET', 'WHITE'), role: 'outer' }).score).toBe(-6)
    expect(pieceTaboo('WEDDING', { ...piece('PANTS', 'WHITE'), role: 'bottom' }).score).toBe(0)
    expect(pieceTaboo('WEDDING', { ...piece('SHIRT', 'SKYBLUE'), role: 'top' }).score).toBe(0)
  })
  it('장례식: 밝은 색/무늬는 감점, 검정·네이비·회색은 가점', () => {
    expect(pieceTaboo('FUNERAL', { ...piece('SHIRT', 'PINK'), role: 'top' }).score).toBe(-5)
    expect(pieceTaboo('FUNERAL', { ...piece('PANTS', 'BLUE'), role: 'bottom' }).score).toBe(-5)
    expect(pieceTaboo('FUNERAL', { ...piece('SHIRT', 'BLACK', 'CHECK'), role: 'top' }).score).toBe(-3) // 무늬 -5, 어두운 색 +2
    expect(pieceTaboo('FUNERAL', { ...piece('SHIRT', 'BLACK'), role: 'top' }).score).toBe(2)
  })
  it('데이트: 큰 프린트만 감점', () => {
    expect(pieceTaboo('DATE', { ...piece('SHIRT', 'WHITE', 'PRINT'), role: 'top' }).score).toBe(-3)
    expect(pieceTaboo('DATE', { ...piece('HOODIE'), role: 'top' }).score).toBe(0)
  })
  it('조합 점수와 이유를 모은다', () => {
    const r = comboTaboo('INTERVIEW', piece('HOODIE'), piece('SHORTS'), null)
    expect(r.score).toBe(-12)
    expect(r.reasons).toEqual(['후드티는 면접 자리에는 너무 편해 보일 수 있어요', '반바지는 면접 자리에는 어울리지 않을 수 있어요'])
  })
})

describe('styleGapHint: 옷장에 없는 종류를 알려준다', () => {
  it('셔츠·바지·겉옷이 없으면 모두 알려준다(받침에 맞는 조사)', () => expect(styleGapHint('SMART', ['HOODIE', 'SHORTS'])).toBe('셔츠나 니트, 긴 바지, 자켓이나 가디건이 있으면 훨씬 단정해 보여요'))
  it('겉옷만 없으면 "가디건이", 바지만 없으면 "바지가"', () => {
    expect(styleGapHint('SMART', ['SHIRT', 'PANTS'])).toBe('자켓이나 가디건이 있으면 훨씬 단정해 보여요')
    expect(styleGapHint('SMART', ['SHIRT', 'JACKET', 'SHORTS'])).toBe('긴 바지가 있으면 훨씬 단정해 보여요')
  })
  it('상의만 없으면 상의만', () => expect(styleGapHint('FORMAL', ['PANTS', 'JACKET', 'HOODIE'])).toBe('셔츠나 니트가 있으면 훨씬 단정해 보여요'))
  it('다 있으면 null, 캐주얼/편한 옷은 알릴 게 없다', () => {
    expect(styleGapHint('FORMAL', ['SHIRT', 'PANTS', 'JACKET'])).toBeNull()
    expect(styleGapHint('CASUAL', [])).toBeNull()
    expect(styleGapHint('COMFORT', [])).toBeNull()
  })
})

describe('stylistApplicable: 야외 일정은 격식 있는 자리가 아니면 도우미를 숨긴다', () => {
  it.each([['여행', '제주 여행'], ['등산', '북한산'], ['캠핑', '가평'], ['야외활동', '피크닉']])('%s "%s" -> 숨김', (k, t) => expect(stylistApplicable(k, t)).toBe(false))
  it('기타 일정은 항상 보인다', () => expect(stylistApplicable('기타', '그냥 약속')).toBe(true))
  it('야외 종류여도 제목에 격식 있는 자리가 있으면 보인다', () => {
    expect(stylistApplicable('여행', '제주 결혼식 하객')).toBe(true)
    expect(stylistApplicable('여행', '호텔 소개팅')).toBe(true)
  })
})

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL', pattern: ClothingPattern = 'SOLID'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `t${String(++seq).padStart(3, '0')}`, type, thickness, color, pattern, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const pts = (temp: number): OutingPoint[] =>
  [0, 6].map((h) => ({ at: new Date(`2026-10-05T${String(h).padStart(2, '0')}:00:00Z`), temp, feels: temp, pop: 10, precip: 'none' as const, wind: 2 }))
const run = (clothes: WardrobeItem[], situation: EngineInput['situation'], seed: string, style?: EngineInput['style']) =>
  recommend({ points: pts(21), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: seed, situation, style } as EngineInput)

describe('추천에서의 금지 규칙', () => {
  const hoodie = cloth('HOODIE', 'GRAY')
  const shirt = cloth('SHIRT', 'SKYBLUE')
  const whiteShirt = cloth('SHIRT', 'WHITE')
  const blackShirt = cloth('SHIRT', 'BLACK')
  const slacks = cloth('PANTS', 'BLACK')

  it('면접: 후드티가 있어도 날짜가 달라져도 셔츠를 고른다(분위기를 고르지 않아도)', () => {
    for (let d = 1; d <= 20; d++) {
      const r = run([hoodie, shirt, slacks], 'INTERVIEW', `u:e:2026-10-${String(d).padStart(2, '0')}`)
      expect(r.items[0]!.clothingId).toBe(shirt.id)
      expect(r.tabooReasons).toEqual([])
    }
  })
  it('결혼식: 흰 셔츠 대신 다른 색 셔츠', () => {
    for (let d = 1; d <= 20; d++) expect(run([whiteShirt, shirt, slacks], 'WEDDING', `u:e:${d}`).items[0]!.clothingId).toBe(shirt.id)
  })
  it('장례식: 하늘색보다 검정 셔츠', () => {
    for (let d = 1; d <= 20; d++) expect(run([shirt, blackShirt, slacks], 'FUNERAL', `u:e:${d}`).items[0]!.clothingId).toBe(blackShirt.id)
  })
  it('상황이 없으면 지금처럼 돌려 고른다(다양성 유지)', () => {
    const tops = new Set<string | null>()
    for (let d = 1; d <= 20; d++) tops.add(run([hoodie, shirt, slacks], undefined, `u:e:2026-10-${String(d).padStart(2, '0')}`).items[0]!.clothingId)
    expect(tops.size).toBeGreaterThan(1)
  })
  it('옷장에 후드티뿐이어도 추천은 하되 어색한 점을 알린다', () => {
    const r = run([hoodie, slacks], 'INTERVIEW', 'u:e:1')
    expect(r.items.map((i) => i.clothingId)).toEqual([hoodie.id, slacks.id])
    expect(r.tabooReasons).toEqual(['후드티는 면접 자리에는 너무 편해 보일 수 있어요'])
    expect(r.comboWhy[0]!.notes.join(' ')).toContain('너무 편해 보일 수 있어요')
  })
})

import { impliedStyle } from '../../src/rules/outfitStyle.js'
describe('impliedStyle: 분위기를 고르지 않았을 때의 기본', () => {
  it('면접·결혼식은 단정, 장례식은 포멀, 데이트는 기본 없음', () => {
    expect(impliedStyle).toEqual({ INTERVIEW: 'SMART', WEDDING: 'SMART', FUNERAL: 'FORMAL', DATE: null })
  })
})
