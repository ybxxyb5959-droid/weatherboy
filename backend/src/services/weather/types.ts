import type { PrecipType } from '../../rules/outfitEngine.js'

/** 시간별 예보(단기예보 기반) */
export interface HourlyForecast {
  targetAt: Date
  temp: number
  pop: number
  precip: PrecipType
  wind: number
  humidity: number | null
  sky: 'clear' | 'partly' | 'cloudy' | null
}

/** 일별 예보(중기예보 기반) */
export interface DailyForecast {
  date: string // KST YYYY-MM-DD
  tempMin: number
  tempMax: number
  pop: number
  precip: PrecipType
  skyText: string | null
}

export interface ShortTermResult {
  issuedAt: Date
  hourly: HourlyForecast[]
  dailyMin: Map<string, number>
  dailyMax: Map<string, number>
}

export interface MidTermResult {
  issuedAt: Date
  daily: DailyForecast[]
}

/** 외부 기상 API 를 내부 DTO 로 변환하는 경계. Controller 는 외부 응답을 직접 다루지 않는다. */
export interface WeatherProvider {
  readonly configured: boolean
  fetchShortTerm(nx: number, ny: number, now: Date): Promise<ShortTermResult>
  fetchMidTerm(regionSido: string, regionDistrict: string | null, now: Date): Promise<MidTermResult>
}

export interface AirQualityReading {
  region: string
  stationName: string | null
  pm10: number | null
  pm25: number | null
  pm10Grade: number | null
  pm25Grade: number | null
}

export interface AirQualityProvider {
  readonly configured: boolean
  fetch(regionSido: string, regionDistrict: string | null): Promise<AirQualityReading>
}
