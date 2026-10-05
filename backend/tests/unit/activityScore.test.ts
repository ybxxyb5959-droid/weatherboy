import { describe, expect, it } from 'vitest'
import { activityByDay } from '../../src/rules/activityScore.js'
import { sunTimes } from '../../src/services/weather/sun.js'
import { forecastAreaOf, forecastGrades } from '../../src/services/airQuality/airkorea.js'
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
  it('쌀쌀한 날(체감 5°)은 "아주 좋아요"가 아니고, 점수가 높아 보여도 쌀쌀하다고 알려준다', () => {
    const d = activityByDay(day({ feels: 5, temp: 5 }), null, 'x')[0]!
    expect(d.score).toBeLessThan(80)
    expect(d.grade).not.toBe('great')
    expect(d.tip).toContain('쌀쌀')
    expect(activityByDay(day({ feels: 14, temp: 14 }), null, 'x')[0]!.tip).toContain('좋은 날씨')
  })
  it('일출·일몰은 위치와 날짜로 계산해 같이 준다 (서울 10월 초: 일출 6시대, 일몰 18시대)', () => {
    const [d] = activityByDay(day(), null, 'x', (date) => sunTimes(date, 37.55, 127.05))
    expect(d!.sun!.rise).toMatch(/^06:/)
    expect(d!.sun!.set).toMatch(/^18:/)
    expect(activityByDay(day(), null, 'x')[0]!.sun).toBeNull()
  })
  it('미세먼지: 오늘이 아닌 날은 날짜별 대기질 예보를 쓰고 "예보"라고 표시한다', () => {
    const none = activityByDay(day(), null, '2026-10-05')[0]!
    expect(none.factors.air.score).toBeNull()
    const bad = activityByDay(day(), null, '2026-10-05', undefined, { '2026-10-10': 3 })[0]!
    expect(bad.factors.air.score).toBe(35)
    expect(bad.factors.air.value).toBe('예보 나쁨')
    expect(bad.score).toBeLessThan(none.score)
  })
  it('미세먼지: 오늘은 측정값과 예보 중 나쁜 쪽을 쓴다', () => {
    const d = (m: number | null, f?: number) => activityByDay(day(), m, '2026-10-10', undefined, f ? { '2026-10-10': f } : undefined)[0]!.factors.air
    expect(d(1, 3).value).toBe('예보 나쁨')
    expect(d(3, 1).value).toBe('나쁨')
    expect(d(2).value).toBe('보통')
  })
})

describe('에어코리아 대기질 예보 해석', () => {
  const rows = [
    { informData: '2026-10-05', dataTime: '2026-10-05 11시 발표', informGrade: '서울 : 보통,경기남부 : 나쁨,영동 : 좋음,영서 : 보통' },
    { informData: '2026-10-05', dataTime: '2026-10-05 17시 발표', informGrade: '서울 : 좋음,경기남부 : 나쁨,영동 : 좋음,영서 : 보통' },
    { informData: '2026-10-06', dataTime: '2026-10-05 17시 발표', informGrade: '서울 : 나쁨,경기남부 : 매우나쁨,영동 : 좋음,영서 : 보통' },
  ]
  it('날짜마다 가장 늦게 발표된 것에서 권역 등급을 뽑는다', () => {
    expect(forecastGrades(rows, '서울')).toEqual({ '2026-10-05': 1, '2026-10-06': 3 })
    expect(forecastGrades(rows, '경기남부')).toEqual({ '2026-10-05': 3, '2026-10-06': 4 })
    expect(forecastGrades(rows, '없는곳')).toEqual({})
  })
  it('경기·강원은 남부/북부, 영동/영서로 가른다', () => {
    expect(forecastAreaOf('서울', '마포구')).toBe('서울')
    expect(forecastAreaOf('경기', '수원시')).toBe('경기남부')
    expect(forecastAreaOf('경기', '고양시')).toBe('경기북부')
    expect(forecastAreaOf('강원', '강릉시')).toBe('영동')
    expect(forecastAreaOf('강원', '춘천시')).toBe('영서')
  })
})
