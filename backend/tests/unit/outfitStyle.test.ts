import { describe, expect, it } from 'vitest'
import type { ClothingType, Thickness } from '@prisma/client'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import type { OutfitStyle } from '../../src/rules/outfitStyle.js'
import { deriveClothing } from '../../src/rules/clothing.js'
import { defaultOptions, detectStyle } from '../../src/services/ai/stylist.js'

let seq = 0
const cloth = (type: ClothingType, color = 'GRAY', thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `s${String(++seq).padStart(3, '0')}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const pts = (temp: number): OutingPoint[] => [
  { at: new Date('2026-10-02T00:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
  { at: new Date('2026-10-02T06:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 },
]
const run = (clothes: WardrobeItem[], temp: number, style?: OutfitStyle) =>
  recommend({ points: pts(temp), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, style } as EngineInput)
const types = (r: ReturnType<typeof run>) => r.items.map((i) => i.type)

const wardrobe = [cloth('HOODIE', 'GRAY'), cloth('SHIRT', 'WHITE'), cloth('KNIT', 'NAVY'), cloth('SHORTS', 'BLUE'), cloth('PANTS', 'BLACK'), cloth('JACKET', 'NAVY'), cloth('WINDBREAKER', 'GREEN')]

describe('옷차림 분위기(style)', () => {
  it('포멀: 셔츠/니트 + 바지 위주로 고른다', () => {
    const r = run(wardrobe, 16, 'FORMAL')
    expect(types(r)).not.toContain('후드티')
    expect(types(r)).not.toContain('반바지')
    expect(types(r)).toContain('바지')
    expect(r.styleMatched).toBe(true)
  })

  it('분위기를 바꿔도 필요한 보온은 채운다', () => {
    const base = run(wardrobe, 8)
    for (const s of ['FORMAL', 'SMART', 'CASUAL', 'COMFORT'] as const) {
      const r = run(wardrobe, 8, s)
      expect(r.requiredWarmth).toBe(base.requiredWarmth)
      expect(r.insufficientWardrobe).toBe(base.insufficientWardrobe)
    }
  })

  it('따뜻한 날엔 포멀이어도 자켓을 억지로 얹지 않는다', () => {
    const r = run(wardrobe, 26, 'FORMAL')
    expect(types(r)).not.toContain('자켓')
  })

  it('분위기에 맞는 옷이 없으면 styleMatched=false', () => {
    const r = run([cloth('HOODIE'), cloth('SHORTS'), cloth('SWEATSHIRT')], 22, 'FORMAL')
    expect(r.styleMatched).toBe(false)
  })

  it('style 이 없으면 예전과 같은 결과 (결정적)', () => {
    expect(run(wardrobe, 16).items).toEqual(run(wardrobe, 16).items)
    expect(run(wardrobe, 16).styleScore).toBeUndefined()
  })
})

describe('코디 상담 키워드/기본 선택지', () => {
  it('말에서 분위기를 알아듣는다', () => {
    expect(detectStyle('정장 입고 싶어')).toBe('FORMAL')
    expect(detectStyle('단정한 비즈니스 캐주얼로')).toBe('SMART')
    expect(detectStyle('편하게 입을래')).toBe('CASUAL')
    expect(detectStyle('뭐 입어야할지 모르겠어 ㅠㅠ')).toBeNull()
  })

  it('면접이면 정장/비즈니스 캐주얼을 먼저 묻는다', () => {
    expect(defaultOptions({ title: '면접', kind: '기타' }).map((o) => o.style)).toEqual(['FORMAL', 'SMART'])
    expect(defaultOptions({ title: '제주 여행', kind: '여행' }).map((o) => o.style)).toEqual(['COMFORT', 'CASUAL'])
  })
})
