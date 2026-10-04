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
  /** 지금 기온이 기상청 실제 관측값이면 관측 시각(정시), 예보값이면 null */
  observedAt?: string | null
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
  /** 옷장에 없지만 사용자가 말한 옷/정장 세트라서 "예시"로 입혀 보여주는 옷(색을 그대로 쓴다) */
  example?: boolean
}

export interface ApiRecommendation {
  /** 다른 지역(즐겨찾기/검색) 추천은 저장하지 않아 null -> 피드백 불가 */
  id: string | null
  items: ApiOutfitItem[]
  needOuter: boolean
  needUmbrella: boolean
  /** 외출 구간에서 비/눈이 처음 걸리는 시각(ISO). 없으면 null/undefined */
  rainAt?: string | null
  needMask: boolean
  maskDataAvailable: boolean
  headline: string
  sub: string
  reasons: string[]
  alternatives: ApiOutfitItem[][]
  /** 조합마다의 요약과 이유([0]=기본 추천, [1..]=다른 조합). 예전 추천에는 없을 수 있다 */
  comboWhy?: { sub: string; notes: string[] }[] | null
  insufficientWardrobe: boolean
  aiExplanation: string | null
  /** AI 설명을 만드는 중: 잠시 뒤 다시 불러오면 들어 있다 */
  aiPending?: boolean
  forecastStage: 'WAITING' | 'MIDTERM' | 'SHORTTERM'
  /** 오늘 추천이 계산된 기준 시간/지역 */
  basis?: { startAt: string; endAt: string; source: 'ROUTINE' | 'DEFAULT' | 'NOW'; place: string | null; reliability: { level: 'OK' | 'CAUTION'; notes: string[] } }
}

export interface EventDaySlot {
  temp: number
  feels: number
  pop: number
}
/** 일정 기간의 하루치 예보 (slots 가 null 이면 시간별 예보가 아직 없는 먼 날짜: 최저/최고만) */
export interface EventDayWeather {
  date: string
  tempMin: number
  tempMax: number
  pop: number
  rain: boolean
  /** 그날을 대표하는 날씨 그림 종류 */
  condition?: 'clear' | 'partly' | 'cloudy' | 'rain' | 'shower' | 'snow' | 'sleet'
  slots: { morning: EventDaySlot | null; afternoon: EventDaySlot | null; evening: EventDaySlot | null } | null
}

/** 며칠짜리 일정의 하루치 코디 (날마다 다른 옷으로 고른다) */
export interface EventDayOutfit {
  date: string
  items: ApiOutfitItem[]
  headline: string
  sub: string
  needUmbrella: boolean
  needMask: boolean
  notes: string[]
}

export interface EventOutfit {
  status: 'waiting' | 'ready'
  weather?: EventDayWeather[]
  /** 1박 2일 이상일 때만 채워진다 */
  days?: EventDayOutfit[]
  forecastStage: 'WAITING' | 'MIDTERM' | 'SHORTTERM'
  recommendation: ApiRecommendation | null
  message: string | null
  /** 코디 도우미에서 일정에 고른 분위기(없으면 날씨만 보고 고른 코디) */
  style?: 'FORMAL' | 'SMART' | 'CASUAL' | 'COMFORT' | null
  styleLabel?: string | null
  /** 고른 코디에서 그 자리(면접·결혼식 등)에 어색한 점. 옷장에 대안이 없어 피하지 못한 경우만 온다 */
  situationNotes?: string[]
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
