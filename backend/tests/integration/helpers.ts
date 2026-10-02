import { vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { providers } from '../../src/services/weather/weatherService.js'
import type { AirQualityProvider, WeatherProvider } from '../../src/services/weather/types.js'

export const { app, pool } = createApp()
export const agent = () => request.agent(app)

/** 외부 호출 없이 쓰는 가짜 기상/대기질 Provider. 현재 시각부터 72시간 시간별 예보를 만든다. */
export function installFakeProviders(opts: { temp?: number; pop?: number; airGrade?: number | null; failAir?: boolean } = {}) {
  const temp = opts.temp ?? 12
  const weather: WeatherProvider = {
    configured: true,
    async fetchShortTerm(_nx, _ny, now) {
      const base = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000 - 6 * 3600_000)
      const hourly = Array.from({ length: 80 }, (_, i) => ({
        targetAt: new Date(base.getTime() + i * 3600_000),
        temp,
        pop: opts.pop ?? 20,
        precip: (opts.pop ?? 20) >= 60 ? ('rain' as const) : ('none' as const),
        wind: 4.2,
        humidity: 60,
        sky: 'cloudy' as const,
      }))
      return { issuedAt: new Date(Math.floor(now.getTime() / (3 * 3600_000)) * 3 * 3600_000), hourly, dailyMin: new Map(), dailyMax: new Map() }
    },
    async fetchMidTerm(_s, _d, now) {
      return { issuedAt: new Date(now.getTime() - 3600_000), daily: [] }
    },
  }
  const air: AirQualityProvider = {
    configured: true,
    async fetch(sido) {
      if (opts.failAir) throw new Error('air down')
      const g = opts.airGrade === undefined ? 2 : opts.airGrade
      return { region: sido, stationName: null, pm10: 35, pm25: 18, pm10Grade: g, pm25Grade: g }
    },
  }
  providers.weather = weather
  providers.air = air
}

/** Kakao 외부 호출 Mock (실제 Kakao 검증이 아님) */
export function mockKakaoFetch(kakaoId = '1234567890') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.startsWith('https://kauth.kakao.com/oauth/token')) return json({ access_token: 'mock-access-token', token_type: 'bearer' })
    if (url.startsWith('https://kapi.kakao.com/v2/user/me')) return json({ id: Number(kakaoId), kakao_account: { profile: { nickname: '카카오유저', profile_image_url: 'https://example.com/p.png' } } })
    if (url.startsWith('https://dapi.kakao.com/v2/local/search/address.json')) {
      return json({ documents: [{ address_name: '서울 마포구', x: '126.9019', y: '37.5663', address: { region_1depth_name: '서울', region_2depth_name: '마포구' } }] })
    }
    throw new Error(`unexpected fetch in test: ${url}`)
  })
}
