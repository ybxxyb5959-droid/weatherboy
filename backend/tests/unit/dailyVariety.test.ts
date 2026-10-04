import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import type { ClothingType, Event, Thickness, User } from '@prisma/client'
import { deriveClothing } from '../../src/rules/clothing.js'
import type { WardrobeItem } from '../../src/rules/outfitEngine.js'
import { hasWishEffect, parseWish, savedWish } from '../../src/rules/outfitWish.js'
import { dailyOutfits, type Computed } from '../../src/services/recommendationService.js'

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `v${++seq}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const day = (d: number, temp: number) => [0, 6].map((h) => ({ at: new Date(`2026-10-0${d}T${String(h).padStart(2, '0')}:00:00Z`), temp, feels: temp, pop: 10, precip: 'none' as const, wind: 2 }))
const user = { id: 'u1', sensitivity: 'NORMAL', feedbackOffset: 0, feedbackBands: null } as unknown as User
const mkEvent = (wish: unknown) => ({ id: 'e1', title: '제주 여행', kind: 'TRAVEL', outfitStyle: null, outfitWish: wish }) as unknown as Event
const mk = (wardrobe: WardrobeItem[], temps = [14, 14, 14]) =>
  ({ window: { points: temps.flatMap((t, i) => day(5 + i, t)), feelsMethod: 'FALLBACK_TEMP' }, wardrobe, airGrade: 2 }) as unknown as Computed
const ids = (d: { items: { clothingId: string | null }[] }) => d.items.map((i) => i.clothingId).filter(Boolean) as string[]

describe('"전부 다르게" 말 알아듣기', () => {
  it.each(['상의 하의 겉옷 전부 다르게 코디', '매일 다르게 입고 싶어', '겹치지 않게 해줘', '옷 안 겹치게', '날마다 다른 옷으로'])('%s', (t) => {
    const w = parseWish(t)
    expect(w?.variety).toBe(true)
    expect(hasWishEffect(w)).toBe(false) // 입힐 옷은 없고 고르는 방식만 바꾼다
  })
  it('색 요청과 같이 말하면 둘 다 담긴다', () => {
    const w = parseWish('검정 상의로 하고 매일 다르게')
    expect(w?.variety).toBe(true)
    expect(hasWishEffect(w)).toBe(true)
  })
  it('관련 없는 말은 variety 가 아니다', () => {
    expect(parseWish('검정 상의 입고 싶어')?.variety).toBeUndefined()
    expect(parseWish('오늘 뭐 입지')).toBeNull()
  })
  it('저장했다 읽어도 유지된다', () => {
    expect(savedWish({ suit: false, variety: true, pieces: [] })?.variety).toBe(true)
  })
})

describe('연박 일정: 겹침 금지', () => {
  // 선선한 날(필요 보온이 비슷), 상의 3 · 하의 3 · 겉옷 3 이 있으면 3일 모두 서로 다른 옷이 가능하다
  const rich = [
    cloth('SWEATSHIRT', 'BLACK'), cloth('HOODIE', 'GRAY'), cloth('KNIT', 'NAVY'),
    cloth('PANTS', 'BLACK'), cloth('PANTS', 'BLUE'), cloth('PANTS', 'BEIGE'),
    cloth('JACKET', 'BLACK'), cloth('WINDBREAKER', 'GREEN'), cloth('CARDIGAN', 'GRAY'),
  ]

  it('"다르게" 요청이면 상의·하의·겉옷이 모든 날 서로 겹치지 않는다', () => {
    const days = dailyOutfits(user, mkEvent({ suit: false, variety: true, pieces: [] }), mk(rich))
    expect(days).toHaveLength(3)
    const all = days.flatMap(ids)
    expect(new Set(all).size).toBe(all.length)
    for (const d of days) expect(d.overlapSlots).toEqual([])
  })

  it('옷이 부족하면 겹치되, 어느 자리가 겹쳤는지 알린다', () => {
    const poor = [cloth('SWEATSHIRT', 'BLACK'), cloth('HOODIE', 'GRAY'), cloth('PANTS', 'BLACK'), cloth('PANTS', 'BLUE'), cloth('JACKET', 'BLACK')]
    const days = dailyOutfits(user, mkEvent({ suit: false, variety: true, pieces: [] }), mk(poor))
    const second = days[1]!
    const third = days[2]!
    expect([...second.overlapSlots, ...third.overlapSlots].length).toBeGreaterThan(0)
    expect([...second.notes, ...third.notes].some((n) => n.includes('앞선 날과 겹쳐요'))).toBe(true)
    expect(days[0]!.overlapSlots).toEqual([])
  })

  it('요청이 없으면 기존처럼 동작한다(겹침 알림만 추가)', () => {
    const days = dailyOutfits(user, mkEvent(null), mk(rich))
    expect(days).toHaveLength(3)
    expect(days.every((d) => Array.isArray(d.overlapSlots))).toBe(true)
  })
})
