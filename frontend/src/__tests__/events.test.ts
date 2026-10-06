import { describe, expect, it } from 'vitest'
import { dDay, formatDay, formatRange } from '../mocks/events'
import { parseEventText } from '../lib/eventParse'
import { parseClothing } from '../lib/clothingParse'
import { feedbackDueAt, FEEDBACK_DELAY_MS } from '../lib/feedbackTiming'

describe('일정 날짜 계산', () => {
  it('dDay: 오늘 0, 내일 1, 어제 -1 (시각과 상관없이 날짜 기준)', () => {
    const late = new Date(2026, 9, 6, 23, 59)
    expect(dDay('2026-10-06', late)).toBe(0)
    expect(dDay('2026-10-07', late)).toBe(1)
    expect(dDay('2026-10-05', new Date(2026, 9, 6, 0, 1))).toBe(-1)
  })
  it('formatRange: 하루, 같은 달, 달을 넘는 일정', () => {
    expect(formatDay('2026-10-18')).toBe('10월 18일')
    expect(formatRange({ startDate: '2026-10-18' } as never)).toBe('10월 18일')
    expect(formatRange({ startDate: '2026-10-18', endDate: '2026-10-18' } as never)).toBe('10월 18일')
    expect(formatRange({ startDate: '2026-10-18', endDate: '2026-10-20' } as never)).toBe('10월 18일~20일')
    expect(formatRange({ startDate: '2026-10-30', endDate: '2026-11-02' } as never)).toBe('10월 30일~11월 2일')
  })
})

describe('말로 입력한 일정·옷 해석', () => {
  it('"다음주 금요일부터 2박 3일 제주 여행"', () => {
    const d = parseEventText('다음주 금요일부터 2박 3일 제주 여행', '2026-10-06')
    expect(d).toMatchObject({ kind: '여행', startDate: '2026-10-16', endDate: '2026-10-18', nights: 2, place: '제주' })
  })
  it('"내일 오후 3시 한강 러닝"은 야외활동, 시작 15:00', () => {
    const d = parseEventText('내일 오후 3시 한강 러닝', '2026-10-06')
    expect(d).toMatchObject({ kind: '야외활동', startDate: '2026-10-07', startTime: '15:00', title: '한강 러닝' })
  })
  it('"검정 맨투맨이랑 청바지"는 두 벌', () => {
    const r = parseClothing('검정 맨투맨이랑 청바지')
    expect(r.unknown).toEqual([])
    expect(r.items.map((i) => [i.type, i.color])).toEqual([
      ['맨투맨', '검정'],
      ['바지', '파랑'],
    ])
  })
})

describe('후기 카드가 뜨는 시각', () => {
  const t0 = new Date(2026, 9, 6, 8, 0).getTime()
  it('기본은 처음 확인한 시각 + 2.5시간', () => {
    expect(feedbackDueAt(t0, undefined, new Date(2026, 9, 6, 8, 5))).toBe(t0 + FEEDBACK_DELAY_MS)
  })
  it('외출하는 요일이면 집을 나선 시각 + 2.5시간으로 미룬다', () => {
    const now = new Date(2026, 9, 6, 8, 5) // 화요일(2)
    const out = new Date(2026, 9, 6, 9, 30).getTime()
    expect(feedbackDueAt(t0, { outAt: '09:30', days: [2] }, now)).toBe(out + FEEDBACK_DELAY_MS)
    expect(feedbackDueAt(t0, { outAt: '09:30', days: [3] }, now)).toBe(t0 + FEEDBACK_DELAY_MS)
  })
})
