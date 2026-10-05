import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: {} }))

import type { Event } from '@prisma/client'
import { eventModeOf } from '../../src/rules/eventMode.js'
import { outfitWanted } from '../../src/services/recommendationService.js'
import { serializeEvent } from '../../src/services/serializers.js'

const ev = (kind: Event['kind'], title = 't') =>
  ({ id: 'e', title, kind, startAt: new Date('2026-10-10T00:00:00Z'), endAt: new Date('2026-10-10T09:00:00Z'), placeName: '', gridNx: null, calendarConnectionId: null, forecastStage: 'WAITING', recommendationVersion: 0 }) as unknown as Event

describe('일정에서 무엇을 보여줄까 (옷차림 / 야외활동 점수 / 날씨만)', () => {
  it('여행·캠핑은 제목과 상관없이 옷차림', () => {
    expect(eventModeOf('TRAVEL', '제주 러닝 여행')).toBe('outfit')
    expect(eventModeOf('CAMPING', '캠핑')).toBe('outfit')
  })
  it('등산은 종류 자체가 활동이라 점수', () => {
    expect(eventModeOf('HIKING', '북한산')).toBe('activity')
  })
  it('야외활동은 제목에 활동 말이 있으면 점수, 없으면(소풍·피크닉) 옷차림', () => {
    expect(eventModeOf('OUTDOOR', '저녁 한강 러닝')).toBe('activity')
    expect(eventModeOf('OUTDOOR', '조기 축구')).toBe('activity')
    expect(eventModeOf('OUTDOOR', '한강 피크닉')).toBe('outfit')
  })
  it('기타는 날씨만, 단 야외 활동 제목이면 점수 (실내 운동은 날씨만)', () => {
    expect(eventModeOf('OTHER', '회식')).toBe('weather')
    expect(eventModeOf('OTHER', '헬스')).toBe('weather')
    expect(eventModeOf('OTHER', '아침 조깅')).toBe('activity')
    expect(eventModeOf('OTHER', '보드게임 모임')).toBe('weather')
  })
  it('옷차림 추천은 outfit 일정에만', () => {
    expect(outfitWanted(ev('TRAVEL'))).toBe(true)
    expect(outfitWanted(ev('OUTDOOR', '피크닉'))).toBe(true)
    expect(outfitWanted(ev('OUTDOOR', '러닝'))).toBe(false)
    expect(outfitWanted(ev('OTHER'))).toBe(false)
  })
  it('응답에도 mode 가 나간다', () => {
    expect(serializeEvent(ev('TRAVEL')).mode).toBe('outfit')
    expect(serializeEvent(ev('TRAVEL')).needsOutfit).toBe(true)
    expect(serializeEvent(ev('HIKING')).mode).toBe('activity')
    expect(serializeEvent(ev('HIKING')).needsOutfit).toBe(false)
    expect(serializeEvent(ev('OTHER')).mode).toBe('weather')
  })
})
