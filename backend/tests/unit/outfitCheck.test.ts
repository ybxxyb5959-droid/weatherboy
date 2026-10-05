import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import type { ClothingType, Event, Thickness, User } from '@prisma/client'
import { deriveClothing } from '../../src/rules/clothing.js'
import { checkWarmth } from '../../src/rules/outfitCheck.js'
import { recommend, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { dailyOutfits, type Computed } from '../../src/services/recommendationService.js'

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `c${++seq}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const day = (d: number, temp: number) => [0, 6].map((h) => ({ at: new Date(`2026-01-0${d}T${String(h).padStart(2, '0')}:00:00Z`), temp, feels: temp, pop: 10, precip: 'none' as const, wind: 2 }))
const user = { id: 'u1', sensitivity: 'NORMAL', feedbackOffset: 0, feedbackBands: null } as unknown as User
const event = { id: 'e1', title: '면접 준비 모임', kind: 'TRAVEL', outfitStyle: 'FORMAL', outfitWish: null } as unknown as Event
const mk = (wardrobe: WardrobeItem[], temp: number) => ({ window: { points: [5, 6].flatMap((d) => day(d, temp)), feelsMethod: 'FALLBACK_TEMP' }, wardrobe, airGrade: 2 }) as unknown as Computed

describe('최종 코디 보온 재검증', () => {
  const warm = [cloth('HOODIE', 'GRAY'), cloth('PANTS', 'BLUE'), cloth('PADDING', 'BLACK')]

  it('내 옷만으로 날씨를 채우면 예시를 입히지 않고, 예시 버튼도 필요 없다', () => {
    const days = dailyOutfits(user, event, mk(warm, 5))
    expect(days).toHaveLength(2)
    for (const d of days) {
      expect(d.items.every((i) => !i.example)).toBe(true)
      expect(d.canViewExamples).toBe(false)
      expect(d.warmthShort).toBe(false)
    }
  })

  it('[예시로 보기]를 눌러 정장 예시로 바꾸면 보온을 다시 세고, 모자라면 알린다', () => {
    const days = dailyOutfits(user, event, mk(warm, 5), new Date(), { examples: true })
    for (const d of days) {
      expect(d.items.some((i) => i.example)).toBe(true)
      expect(d.warmthShort).toBe(true)
      expect(d.notes.join(' ')).toContain('보온이 부족')
      expect(d.sub).toBe('예시 옷으로 입어본 코디예요')
      expect(d.notes.join(' ')).not.toContain('딱 맞는') // 바뀌기 전 코디의 설명이 남지 않는다
    }
  })

  it('옷장에 상의·하의만 있어 날씨에 모자라면 예시로 볼 수 있다고 알린다', () => {
    const thin = [cloth('SHORT_SLEEVE' as ClothingType, 'WHITE'), cloth('PANTS', 'BLUE')]
    const days = dailyOutfits(user, event, mk(thin, 2))
    expect(days.every((d) => d.canViewExamples)).toBe(true)
  })

  it('checkWarmth: 옷장 옷은 저장된 보온값, 예시 옷은 보통 두께 기본값으로 센다', () => {
    const w = warm
    const r = recommend({ points: day(5, 5), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: w, airGrade: 2 })
    const owned = checkWarmth(r.items, w, r.requiredWarmth)
    expect(owned.short).toBe(false)
    const swapped = checkWarmth([{ clothingId: null, type: '셔츠', color: '흰색', pattern: '무지', label: '흰색 셔츠(예시)', owned: false, example: true }], w, r.requiredWarmth)
    expect(swapped.short).toBe(true)
    expect(swapped.total).toBeGreaterThan(0)
  })
})
