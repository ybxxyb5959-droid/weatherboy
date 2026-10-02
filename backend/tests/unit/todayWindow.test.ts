import { describe, expect, it } from 'vitest'
import { todayWindow, type Routine } from '../../src/services/recommendationService.js'

// 2026-10-05 는 월요일(KST)
const kst = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+09:00`)
const weekdays: Routine = { outAt: '08:30', homeAt: '19:00', days: [1, 2, 3, 4, 5] }

describe('todayWindow: 하루 패턴 반영', () => {
  it('패턴이 없으면 기본 07~22시', () => {
    const w = todayWindow(kst('2026-10-05', '06:00'))
    expect(w.source).toBe('DEFAULT')
    expect(w.start).toEqual(kst('2026-10-05', '07:00'))
    expect(w.end).toEqual(kst('2026-10-05', '22:00'))
  })

  it('패턴 요일(월)에는 외출~귀가 시간을 쓴다', () => {
    const w = todayWindow(kst('2026-10-05', '06:00'), weekdays)
    expect(w).toMatchObject({ source: 'ROUTINE', start: kst('2026-10-05', '08:30'), end: kst('2026-10-05', '19:00') })
  })

  it('패턴에 없는 요일(일)에는 기본 시간', () => {
    expect(todayWindow(kst('2026-10-04', '06:00'), weekdays).source).toBe('DEFAULT')
  })

  it('외출 중이면 이미 지난 시간(1시간 전 이전)은 뺀다', () => {
    const w = todayWindow(kst('2026-10-05', '12:00'), weekdays)
    expect(w).toMatchObject({ source: 'ROUTINE', start: kst('2026-10-05', '11:00'), end: kst('2026-10-05', '19:00') })
  })

  it('귀가까지 3시간도 안 남으면 지금부터 3시간', () => {
    const w = todayWindow(kst('2026-10-05', '18:00'), weekdays)
    expect(w).toMatchObject({ source: 'NOW', start: kst('2026-10-05', '17:00'), end: kst('2026-10-05', '21:00') })
  })

  it('야간 외출(22:00~다음 날 06:00)은 다음 날 귀가로 본다', () => {
    const night: Routine = { outAt: '22:00', homeAt: '06:00', days: [1] }
    const w = todayWindow(kst('2026-10-05', '09:00'), night)
    expect(w).toMatchObject({ source: 'ROUTINE', start: kst('2026-10-05', '22:00'), end: kst('2026-10-06', '06:00') })
  })

  it('어젯밤 시작한 야간 외출이 새벽까지 이어지면 그 구간을 쓴다', () => {
    const night: Routine = { outAt: '20:00', homeAt: '07:00', days: [1] }
    const w = todayWindow(kst('2026-10-06', '00:30'), night) // 화요일 새벽, 월요일 밤 외출 중
    expect(w.source === 'ROUTINE' || w.source === 'NOW').toBe(true)
    expect(w.end.getTime()).toBeLessThanOrEqual(kst('2026-10-06', '07:00').getTime() + 3 * 3600_000)
  })

  it('외출/귀가 중 하나라도 비어 있으면 기본 시간', () => {
    expect(todayWindow(kst('2026-10-05', '06:00'), { outAt: '08:30', homeAt: null, days: [1] }).source).toBe('DEFAULT')
  })
})
