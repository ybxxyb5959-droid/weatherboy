// 백엔드 API 응답 타입 (docs/api.md). 한국어 enum 값은 프론트 기존 표기 그대로.
import type { WeatherKind } from './components/DoodleWeather'

export interface Me {
  id: string
  provider: 'KAKAO' | 'GUEST' | null
  nickname: string | null
  profileImageUrl: string | null
  plan: 'FREE' | 'PREMIUM'
  onboardingDone: boolean
}

export interface ApiHourly {
  time: string
  hour: number
  temp: number
  pop: number
  condition: WeatherKind
}

export interface ApiDaily {
  date: string // YYYY-MM-DD (KST)
  tempMin: number
  tempMax: number
  pop: number
  condition: WeatherKind
}

export interface ApiWeather {
  daily?: ApiDaily[]
  hourly?: ApiHourly[]
  location: string
  temp: number
  feels: number
  rainChance: number
  humidity?: number | null
  tempMin: number | null
  tempMax: number | null
  wind: { speed: number; label: string }
  dust: { pm10: number | null; pm25: number | null; grade: string | null } | null
  condition: WeatherKind
  flags: WeatherKind[]
  stale: boolean
}

export interface ApiOutfitItem {
  clothingId: string | null
  type: string
  color: string
  pattern?: string
  label: string
  owned: boolean
}

export interface ApiRecommendation {
  /** 다른 지역(즐겨찾기/검색) 추천은 저장하지 않아 null -> 피드백 불가 */
  id: string | null
  items: ApiOutfitItem[]
  needOuter: boolean
  needUmbrella: boolean
  needMask: boolean
  maskDataAvailable: boolean
  headline: string
  sub: string
  reasons: string[]
  alternatives: ApiOutfitItem[][]
  insufficientWardrobe: boolean
  aiExplanation: string | null
  forecastStage: 'WAITING' | 'MIDTERM' | 'SHORTTERM'
}

export interface EventOutfit {
  status: 'waiting' | 'ready'
  forecastStage: 'WAITING' | 'MIDTERM' | 'SHORTTERM'
  recommendation: ApiRecommendation | null
  message: string | null
}

export interface Favorite {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  regionSido: string | null
  regionDistrict: string | null
}

export interface Suggestion {
  name: string
  sido: string
  district: string | null
}

/** 홈에서 보고 있는 지역: 내 기본 위치 / 즐겨찾기 / 검색해서 고른 지역 */
export type Target = { kind: 'home' } | { kind: 'fav'; id: string; name: string } | { kind: 'place'; name: string }
