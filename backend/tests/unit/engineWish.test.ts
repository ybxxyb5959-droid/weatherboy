import { describe, expect, it } from 'vitest'
import type { ClothingType, Thickness } from '@prisma/client'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { deriveClothing } from '../../src/rules/clothing.js'
import { parseWish, toEngineWish } from '../../src/rules/outfitWish.js'

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `w${String(++seq).padStart(3, '0')}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const pts = (temp: number): OutingPoint[] => [0, 6].map((h) => ({ at: new Date(`2026-10-05T${String(h).padStart(2, '0')}:00:00Z`), temp, feels: temp, pop: 10, precip: 'none' as const, wind: 2 }))
const run = (clothes: WardrobeItem[], wishText: string | null, temp = 21) =>
  recommend({ points: pts(temp), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes, airGrade: 2, varietySeed: 'u:e:2026-10-05', wish: wishText ? toEngineWish(parseWish(wishText)!) : undefined } as EngineInput)

describe('원하는 톤은 날씨 조건 안에서 옷장 조합을 고른다', () => {
  const darkTop = cloth('LONG_SLEEVE', 'BLACK')
  const lightTop = cloth('LONG_SLEEVE', 'WHITE')
  const darkBottom = cloth('PANTS', 'NAVY')
  const lightBottom = cloth('PANTS', 'BEIGE')
  const wardrobe = [darkTop, lightTop, darkBottom, lightBottom]

  it('"상의는 어둡고 하의는 밝게" -> 어두운 상의 + 밝은 하의', () => {
    const r = run(wardrobe, '상의는 어둡고 하의는 밝게')
    expect(r.items[0]!.clothingId).toBe(darkTop.id)
    expect(r.items[1]!.clothingId).toBe(lightBottom.id)
  })
  it('반대로 말하면 반대로 고른다', () => {
    const r = run(wardrobe, '상의는 밝게 하의는 어둡게')
    expect(r.items[0]!.clothingId).toBe(lightTop.id)
    expect(r.items[1]!.clothingId).toBe(darkBottom.id)
  })
  it('색을 콕 집으면 그 색 옷을 고른다', () => {
    expect(run(wardrobe, '하얀 상의 입고 싶어').items[0]!.clothingId).toBe(lightTop.id)
  })
  it('날씨 조건은 깨지지 않는다: 추운 날 반바지를 원해도 반바지가 나오지 않는다', () => {
    const shorts = cloth('SHORTS', 'BLACK')
    const r = run([...wardrobe, shorts], '검정 반바지 입을래', 2)
    expect(r.items.find((i) => i.type === '반바지')).toBeUndefined()
  })
})

describe('상의 색을 말하면 겉옷은 튀지 않는 색을 고른다', () => {
  it('분홍 상의를 원하면 초록 가디건보다 검정 가디건', () => {
    const top = cloth('LONG_SLEEVE', 'WHITE')
    const bottom = cloth('PANTS', 'BLACK')
    const green = cloth('CARDIGAN', 'GREEN')
    const black = cloth('CARDIGAN', 'BLACK')
    const r = run([top, bottom, green, black], '핑크색 상의에 어두운 바지', 15)
    const outer = r.items.find((i) => i.type === '가디건')
    expect(outer?.clothingId).toBe(black.id)
  })
})
