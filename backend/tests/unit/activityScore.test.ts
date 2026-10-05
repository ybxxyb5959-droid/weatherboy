import { describe, expect, it } from 'vitest'
import { activityByDay } from '../../src/rules/activityScore.js'
import { sunTimes } from '../../src/services/weather/sun.js'
import type { OutingPoint } from '../../src/rules/outfitEngine.js'

// KST 날짜/시각으로 점 만들기 (KST = UTC+9)
const at = (hour: number, day = '2026-10-10') => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+09:00`)
const pt = (hour: number, o: Partial<OutingPoint> = {}): OutingPoint => ({ at: at(hour), temp: 14, feels: 14, pop: 0, precip: 'none', wind: 2, ...o })
const day = (o: Partial<OutingPoint> = {}) => [8, 10, 12, 14, 16, 18, 20].map((h) => pt(h, o))

describe('야외활동 점수', () => {
  it('선선하고 바람 없고 비 없으면 아주 좋음', () => {
    const [d] = activityByDay(day(), 1, '2026-10-10')
    expect(d!.score).toBeGreaterThanOrEqual(90)
    expect(d!.grade).toBe('great')
  })
  it('비가 오면 크게 깎인다', () => {
    const [d] = activityByDay(day({ precip: 'rain', pop: 80 }), null, '2026-10-10')
    expect(d!.score).toBeLessThan(45)
    expect(d!.tip).toContain('비')
  })
  it('미세먼지 매우 나쁨이면 쉬는 게 좋고, 정보가 없으면 계산에서 빠진다', () => {
    const bad = activityByDay(day(), 4, '2026-10-10')[0]!
    expect(bad.score).toBeLessThan(45)
    const none = activityByDay(day(), 4, '2026-10-11')[0]! // 다른 날짜엔 지금 대기질을 쓰지 않는다
    expect(none.factors.air.score).toBeNull()
    expect(none.score).toBeGreaterThanOrEqual(90)
  })
  it('강풍·혹한·폭염은 점수를 낮춘다', () => {
    expect(activityByDay(day({ wind: 12 }), null, 'x')[0]!.factors.wind.score!).toBeLessThan(30)
    expect(activityByDay(day({ feels: -8, temp: -4 }), null, "x")[0]!.score).toBeLessThan(40)
    expect(activityByDay(day({ feels: 33, temp: 31 }), null, "x")[0]!.score).toBeLessThan(40)
  })
  it('일출·일몰은 위치와 날짜로 계산해 같이 준다 (서울 10월 초: 일출 6시대, 일몰 18시대)', () => {
    const [d] = activityByDay(day(), null, 'x', (date) => sunTimes(date, 37.55, 127.05))
    expect(d!.sun!.rise).toMatch(/^06:/)
    expect(d!.sun!.set).toMatch(/^18:/)
    expect(activityByDay(day(), null, 'x')[0]!.sun).toBeNull()
  })
})
