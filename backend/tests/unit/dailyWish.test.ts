import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import type { ClothingType, Event, Thickness, User } from '@prisma/client'
import { deriveClothing } from '../../src/rules/clothing.js'
import type { WardrobeItem } from '../../src/rules/outfitEngine.js'
import { dailyOutfits, type Computed } from '../../src/services/recommendationService.js'

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `d${++seq}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const day = (d: number, temp: number) => [0, 6].map((h) => ({ at: new Date(`2026-10-0${d}T${String(h).padStart(2, '0')}:00:00Z`), temp, feels: temp, pop: 10, precip: 'none' as const, wind: 2 }))

const user = { id: 'u1', sensitivity: 'NORMAL', feedbackOffset: 0, feedbackBands: null } as unknown as User
const mkEvent = (wish: unknown) => ({ id: 'e1', title: '제주 여행', kind: 'TRAVEL', outfitStyle: null, outfitWish: wish }) as unknown as Event
// 초록/하늘/남색 후드티와 맨투맨, 파랑·베이지·검정 바지가 있는 옷장(검정 상의는 없음)
const wardrobe = [cloth('HOODIE', 'GREEN'), cloth('HOODIE', 'BEIGE'), cloth('SWEATSHIRT', 'NAVY'), cloth('PANTS', 'BLUE'), cloth('PANTS', 'BEIGE'), cloth('PANTS', 'BLACK')]
const computed = { window: { points: [...day(5, 18), ...day(6, 18), ...day(7, 18)], feelsMethod: 'FALLBACK_TEMP' }, wardrobe, airGrade: 2 } as unknown as Computed

describe('연박 일정: 말로 정한 원하는 옷이 날짜별 코디에 반영된다', () => {
  const wish = { suit: false, pieces: [{ role: 'top', color: '검정' }, { role: 'bottom', color: '검정' }] }

  it('"3일 모두 검정옷": 모든 날 상의·하의가 검정이고(옷장에 없으면 예시), 상의 종류는 날마다 다르다', () => {
    const days = dailyOutfits(user, mkEvent(wish), computed)
    expect(days).toHaveLength(3)
    for (const d of days) {
      const top = d.items.find((i) => ['후드티', '맨투맨', '니트', '긴팔', '셔츠', '반팔'].includes(i.type))!
      const bottom = d.items.find((i) => i.type === '바지')!
      expect(top.color).toBe('검정')
      expect(bottom.color).toBe('검정')
    }
    const tops = days.map((d) => d.items.find((i) => ['후드티', '맨투맨', '니트'].includes(i.type))!.type)
    expect(new Set(tops).size).toBeGreaterThan(1)
  })

  it('원하는 옷이 없으면 지금처럼 그대로(검정을 강요하지 않는다)', () => {
    const days = dailyOutfits(user, mkEvent(null), computed)
    expect(days.some((d) => d.items.some((i) => i.example))).toBe(false)
  })
})
