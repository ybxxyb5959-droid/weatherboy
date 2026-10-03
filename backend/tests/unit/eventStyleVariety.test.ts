import { describe, expect, it } from 'vitest'
import type { ClothingType, Thickness } from '@prisma/client'
import { recommend, type EngineInput, type OutingPoint, type WardrobeItem } from '../../src/rules/outfitEngine.js'
import { deriveClothing } from '../../src/rules/clothing.js'

let seq = 0
const cloth = (type: ClothingType, color: string, thickness: Thickness = 'NORMAL'): WardrobeItem => {
  const d = deriveClothing(type, thickness)
  return { id: `s${String(++seq).padStart(3, '0')}`, type, thickness, color, category: d.category, warmth: d.warmth, windproof: false, waterproof: false, owned: true }
}
const pts = (date: string): OutingPoint[] =>
  [0, 6].map((h) => ({ at: new Date(`${date}T${String(h).padStart(2, '0')}:00:00Z`), temp: 21, feels: 21, pop: 10, precip: 'none' as const, wind: 2 }))

// 같은 보온의 상의/하의가 섞여 있는 옷장
const shirt = cloth('SHIRT', 'WHITE')
const hoodie = cloth('HOODIE', 'GRAY')
const sweat = cloth('SWEATSHIRT', 'GRAY')
const slacks = cloth('PANTS', 'BLACK')
const shorts = cloth('SHORTS', 'GRAY')
const wardrobe = [shirt, hoodie, sweat, slacks, shorts]

describe('일정에 고른 분위기는 날짜마다 돌려 고를 때도 지켜진다', () => {
  it('SMART 를 고르면 날짜가 달라져도 후드티/맨투맨 대신 셔츠를 고른다', () => {
    for (let d = 1; d <= 20; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`
      const r = recommend({ points: pts(date), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: wardrobe, airGrade: 2, varietySeed: `u:e:${date}`, style: 'SMART' } as EngineInput)
      expect(r.items[0]!.clothingId).toBe(shirt.id)
    }
  })

  it('분위기를 고르지 않으면 지금처럼 날짜마다 돌려 고른다(다양성 유지)', () => {
    const tops = new Set<string | null>()
    for (let d = 1; d <= 20; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`
      tops.add(recommend({ points: pts(date), sensitivity: 'NORMAL', feedbackOffset: 0, eventKind: null, clothes: wardrobe, airGrade: 2, varietySeed: `u:e:${date}` } as EngineInput).items[0]!.clothingId)
    }
    expect(tops.size).toBeGreaterThan(1)
  })
})
