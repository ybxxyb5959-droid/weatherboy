import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import type { Event } from '@prisma/client'
import { outfitWanted } from '../../src/services/recommendationService.js'
import { serializeEvent } from '../../src/services/serializers.js'

const ev = (kind: Event['kind'], needsOutfit: boolean) =>
  ({ id: 'e', title: 't', kind, needsOutfit, startAt: new Date('2026-10-10T00:00:00Z'), endAt: new Date('2026-10-10T09:00:00Z'), placeName: '', gridNx: null, calendarConnectionId: null, forecastStage: 'WAITING', recommendationVersion: 0 }) as unknown as Event

describe('옷차림이 필요한 일정인가', () => {
  it('여행·캠핑·등산·야외활동은 기본으로 필요하고, 끌 수 있다', () => {
    for (const k of ['TRAVEL', 'CAMPING', 'HIKING', 'OUTDOOR'] as const) {
      expect(outfitWanted(ev(k, true))).toBe(true)
      expect(outfitWanted(ev(k, false))).toBe(false)
    }
  })
  it('기타는 값과 상관없이 항상 날씨만 보여준다', () => {
    expect(outfitWanted(ev('OTHER', true))).toBe(false)
    expect(outfitWanted(ev('OTHER', false))).toBe(false)
  })
  it('응답에도 같은 값이 나간다', () => {
    expect(serializeEvent(ev('TRAVEL', true)).needsOutfit).toBe(true)
    expect(serializeEvent(ev('OTHER', true)).needsOutfit).toBe(false)
    expect(serializeEvent(ev('HIKING', false)).needsOutfit).toBe(false)
  })
})
