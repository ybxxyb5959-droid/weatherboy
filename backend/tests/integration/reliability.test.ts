import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { reliabilityOf } from '../../src/services/recommendationService.js'
import { getAirQuality, providers, type WindowForecast } from '../../src/services/weather/weatherService.js'
import type { AirQualityProvider } from '../../src/services/weather/types.js'
import { installFakeProviders, pool } from './helpers.js'

beforeAll(() => installFakeProviders())
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('대기질 캐시', () => {
  const uniq = `테스트시도${Date.now()}`
  const region = { nx: 1, ny: 1, sido: uniq, district: '가나구' }

  const countingAir = (impl?: () => never) => {
    const fetch = vi.fn(async (sido: string) => {
      if (impl) impl()
      // 측정소 이름이 요청한 구 이름과 달라도 캐시가 맞아야 한다 (예전에는 이 경우 매번 다시 불러왔다)
      return { region: sido, stationName: '다른측정소', pm10: 30, pm25: 15, pm10Grade: 2, pm25Grade: 2 }
    })
    const air: AirQualityProvider = { configured: true, fetch }
    providers.air = air
    return fetch
  }

  it('같은 지역을 연달아 물어도 외부 호출은 한 번', async () => {
    const fetch = countingAir()
    await getAirQuality(region)
    await getAirQuality(region)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('동시에 여러 번 물어도 외부 호출은 한 번', async () => {
    const r2 = { ...region, district: '다라구' }
    const fetch = countingAir()
    const rs = await Promise.all([getAirQuality(r2), getAirQuality(r2), getAirQuality(r2)])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(rs.every((x) => x?.pm10Grade === 2)).toBe(true)
  })

  it('같은 시도의 다른 구는 따로 캐시한다', async () => {
    const fetch = countingAir()
    await getAirQuality({ ...region, district: '마바구' })
    expect(fetch).toHaveBeenCalledTimes(1)
    await getAirQuality(region) // 이미 캐시된 구
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('새로 못 받아와도 3시간 안의 마지막 값이 있으면 그걸 쓴다', async () => {
    const r = { ...region, district: '사아구' }
    countingAir()
    await getAirQuality(r)
    await prisma.airQuality.updateMany({ where: { region: `${uniq}|사아구` }, data: { fetchedAt: new Date(Date.now() - 60 * 60_000) } }) // 1시간 전 -> 캐시 만료
    countingAir(() => {
      throw new Error('air down')
    })
    expect((await getAirQuality(r))?.pm10Grade).toBe(2)
  })
})

describe('예보 신뢰도 문구', () => {
  const now = new Date('2026-10-05T03:00:00Z')
  const base: WindowForecast = { stage: 'SHORTTERM', points: [], feelsMethod: 'X', tempMin: 10, tempMax: 20, stale: false, usedMid: false, issuedAt: new Date('2026-10-05T01:00:00Z'), shortCount: 10, expectedCount: 10 }

  it('충분하고 최신이면 OK', () => {
    expect(reliabilityOf(base, now)).toEqual({ level: 'OK', notes: [] })
  })
  it('시간별 예보가 일부만 있어도 사용자에게 따로 알리지 않는다', () => {
    expect(reliabilityOf({ ...base, shortCount: 4 }, now)).toEqual({ level: 'OK', notes: [] })
  })
  it('중기예보가 섞이면 덜 정확하다고 알려준다', () => {
    expect(reliabilityOf({ ...base, usedMid: true }, now).notes.join(' ')).toContain('중기예보')
  })
  it('저장된 예보를 쓴 경우와 오래된 예보를 알려준다', () => {
    const r = reliabilityOf({ ...base, stale: true, issuedAt: new Date('2026-10-04T15:00:00Z') }, now)
    expect(r.notes).toHaveLength(2)
  })
})
