import { describe, expect, it } from 'vitest'
import { deriveCondition, hourlyKind } from '../../src/services/weather/conditions.js'
import { isNightAt, solarElevation } from '../../src/services/weather/sun.js'
import { gridToLatLng, latLngToGrid } from '../../src/utils/grid.js'
import type { HourlyForecast } from '../../src/services/weather/types.js'

// 서울(37.5665, 126.978). 시각은 한국 시간(+09:00)으로 적는다.
const SEOUL = { lat: 37.5665, lng: 126.978 }
const night = (kst: string, p = SEOUL) => isNightAt(new Date(`${kst}+09:00`), p.lat, p.lng)

describe('일몰·일출 계산 (서울)', () => {
  // 서울의 실제 값(한국천문연구원): 하지 일출 05:11 · 일몰 19:57 / 동지 일출 07:43 · 일몰 17:17. 10/5 은 일출 약 06:31 · 일몰 약 18:10.
  it('가을(10/5): 한낮은 낮, 일몰 뒤는 밤, 새벽은 밤, 일출 뒤는 낮', () => {
    expect(night('2026-10-05T12:00:00')).toBe(false)
    expect(night('2026-10-05T17:40:00')).toBe(false)
    expect(night('2026-10-05T18:20:00')).toBe(true)
    expect(night('2026-10-05T23:00:00')).toBe(true)
    expect(night('2026-10-05T05:40:00')).toBe(true)
    expect(night('2026-10-05T06:40:00')).toBe(false)
  })
  it('여름(하지 6/21): 저녁 7시 반까지는 낮, 8시 반은 밤', () => {
    expect(night('2026-06-21T19:30:00')).toBe(false)
    expect(night('2026-06-21T20:30:00')).toBe(true)
  })
  it('겨울(동지 12/22): 오후 5시는 낮, 5시 40분은 밤, 아침 7시는 아직 밤', () => {
    expect(night('2026-12-22T17:00:00')).toBe(false)
    expect(night('2026-12-22T17:40:00')).toBe(true)
    expect(night('2026-12-22T07:00:00')).toBe(true)
    expect(night('2026-12-22T08:15:00')).toBe(false)
  })
  it('한낮의 태양 고도는 계절에 맞다(서울 하지 약 76°, 동지 약 29°)', () => {
    expect(solarElevation(new Date('2026-06-21T12:30:00+09:00'), SEOUL.lat, SEOUL.lng)).toBeGreaterThan(74)
    expect(solarElevation(new Date('2026-06-21T12:30:00+09:00'), SEOUL.lat, SEOUL.lng)).toBeLessThan(78)
    const winter = solarElevation(new Date('2026-12-22T12:30:00+09:00'), SEOUL.lat, SEOUL.lng)
    expect(winter).toBeGreaterThan(27)
    expect(winter).toBeLessThan(31)
  })
  it('동쪽(독도)이 서쪽(서해)보다 먼저 해가 진다', () => {
    const t = '2026-10-05T18:00:00' // 독도는 17:51 에 지고, 서해 쪽은 18:13 에 진다
    expect(night(t, { lat: 37.24, lng: 131.87 })).toBe(true) // 독도
    expect(night(t, { lat: 37.45, lng: 126.3 })).toBe(false) // 서해 쪽
  })
})

describe('기상청 격자 -> 위경도 (역변환)', () => {
  it.each([
    ['서울', 37.5665, 126.978],
    ['부산', 35.1796, 129.0756],
    ['제주', 33.4996, 126.5312],
    ['강릉', 37.7519, 128.8761],
  ])('%s: 격자로 바꿨다가 되돌려도 같은 격자이고 좌표 차이가 작다', (_n, lat, lng) => {
    const g = latLngToGrid(lat, lng)
    const back = gridToLatLng(g.nx, g.ny)
    expect(Math.abs(back.lat - lat)).toBeLessThan(0.06) // 격자 한 칸(5km) 안
    expect(Math.abs(back.lng - lng)).toBeLessThan(0.06)
    expect(latLngToGrid(back.lat, back.lng)).toEqual(g)
  })
})

describe('날씨 그림 종류: 밤에는 맑음·구름 조금만 달로 바뀐다', () => {
  const now = new Date('2026-10-05T19:30:00+09:00')
  const base: HourlyForecast = { targetAt: now, temp: 15, pop: 10, precip: 'none', sky: 'clear', wind: 2, humidity: 50 } as HourlyForecast
  const cond = (over: Partial<HourlyForecast>, nightFlag: boolean, extra: { dustGrade?: number | null; feels?: number } = {}) =>
    deriveCondition({ now, current: { ...base, ...over }, feels: extra.feels ?? 15, tempMin: 12, tempMax: 18, dustGrade: extra.dustGrade ?? 1, night: nightFlag }).condition

  it('맑음: 낮은 해, 밤은 달', () => {
    expect(cond({ sky: 'clear' }, false)).toBe('clear')
    expect(cond({ sky: 'clear' }, true)).toBe('night')
  })
  it('구름 조금: 낮은 해가 구름 뒤, 밤은 달이 구름 뒤', () => {
    expect(cond({ sky: 'partly' }, false)).toBe('partly')
    expect(cond({ sky: 'partly' }, true)).toBe('partlynight')
  })
  it('흐림은 밤에도 그대로', () => {
    expect(cond({ sky: 'cloudy' }, true)).toBe('cloudy')
  })
  it('비·눈·진눈깨비·소나기·바람·미세먼지·폭염은 밤에도 그대로', () => {
    for (const p of ['rain', 'snow', 'sleet', 'shower'] as const) expect(cond({ precip: p, sky: 'clear' }, true)).toBe(p)
    expect(cond({ wind: 12 }, true)).toBe('windy')
    expect(cond({}, true, { dustGrade: 3 })).toBe('dust')
    expect(cond({}, true, { feels: 35 })).toBe('heat')
  })
  it('해가 졌는지 모를 때(night 없음)는 예전처럼 20시~새벽 5시를 밤으로 본다', () => {
    const r = deriveCondition({ now: new Date('2026-10-05T21:00:00+09:00'), current: { ...base, sky: 'partly' }, feels: 15, tempMin: null, tempMax: null, dustGrade: 1 })
    expect(r.condition).toBe('partlynight')
  })
  it('시간별 줄도 같은 규칙', () => {
    expect(hourlyKind({ precip: 'none', sky: 'clear' }, true)).toBe('night')
    expect(hourlyKind({ precip: 'none', sky: 'partly' }, true)).toBe('partlynight')
    expect(hourlyKind({ precip: 'none', sky: 'partly' }, false)).toBe('partly')
    expect(hourlyKind({ precip: 'none', sky: 'cloudy' }, true)).toBe('cloudy')
    expect(hourlyKind({ precip: 'rain', sky: 'clear' }, true)).toBe('rain')
    expect(hourlyKind({ precip: 'none', sky: null }, true)).toBe('cloudy')
  })
})
