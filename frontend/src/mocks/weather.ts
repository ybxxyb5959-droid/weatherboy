// Mock: 이후 GET /api/weather/today, GET /api/recommendations/today 로 교체
export interface Weather {
  location: string
  temp: number
  feels: number
  rainChance: number
  wind: string
  dust: string
}

export interface OutfitItem {
  label: string
  type: string
  color: string
}

export interface Recommendation {
  items: OutfitItem[]
  needOuter: boolean
  needUmbrella: boolean
  needMask: boolean
  headline: string
  sub: string
  reasons: string[]
}

export const todayWeather: Weather = {
  location: '서울 마포구',
  temp: 12,
  feels: 9,
  rainChance: 20,
  wind: '약간 강함',
  dust: '보통',
}

export const todayRecommendation: Recommendation = {
  items: [
    { label: '맨투맨', type: '맨투맨', color: '회색' },
    { label: '경량패딩', type: '패딩', color: '파랑' },
  ],
  needOuter: true,
  needUmbrella: false,
  needMask: true,
  headline: '좀 쌀쌀해요',
  sub: '겉옷 챙기는 게 좋아요',
  reasons: [
    '체감온도가 9°C 라서 맨투맨만으론 좀 추워요',
    '바람이 약간 강해서 방풍되는 겉옷이 좋아요',
    '비 올 확률 20%라 우산은 안 챙겨도 돼요',
    '미세먼지 보통이지만 마스크 하나쯤은 챙겨요',
  ],
}

export const alternativeOutfits: OutfitItem[][] = [
  [
    { label: '후드티', type: '후드티', color: '검정' },
    { label: '바람막이', type: '바람막이', color: '초록' },
  ],
  [
    { label: '긴팔', type: '긴팔', color: '베이지' },
    { label: '자켓', type: '자켓', color: '검정' },
  ],
]
