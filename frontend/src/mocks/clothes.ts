// Mock: 이후 GET/POST /api/clothes 로 교체
export interface Clothing {
  id: string
  type: string
  thickness: string
  color: string
  pattern?: string
  windproof: boolean
  waterproof: boolean
  /** 온보딩 예시 옷: '내 옷이에요'로 확인하기 전에는 추천에 쓰이지 않는다 */
  isSample?: boolean
}

export const clothingTypes = ['반팔', '긴팔', '맨투맨', '니트', '후드티', '바지', '반바지', '치마', '바람막이', '자켓', '코트', '패딩']

// 옷장 빨랫줄 구분
export const categories = [
  { name: '상의', types: ['반팔', '긴팔', '맨투맨', '니트', '후드티'] },
  { name: '하의', types: ['바지', '반바지', '치마'] },
  { name: '가벼운 겉옷', types: ['바람막이', '자켓'] },
  { name: '코트·패딩', types: ['코트', '패딩'] },
]
export const thicknesses = ['얇음', '보통', '두꺼움']
export const colorNames = ['검정', '회색', '흰색', '베이지', '갈색', '카키', '초록', '네이비', '파랑', '하늘색', '빨강', '분홍', '주황', '노랑', '보라', '기타']
export const patternNames = ['무지', '체크', '줄무늬', '도트', '프린트']

export const colorHex: Record<string, string> = {
  검정: '#3a3a3a',
  회색: '#b4b4b0',
  흰색: '#fbfaf4',
  베이지: '#e3cfa6',
  갈색: '#8a6445',
  카키: '#a3a066',
  초록: '#79b87a',
  네이비: '#2f3f66',
  파랑: '#6f9fd6',
  하늘색: '#a9cdf0',
  빨강: '#d9534f',
  분홍: '#f0a8bd',
  주황: '#f08a3c',
  노랑: '#f2d64a',
  보라: '#9a7bc4',
  기타: '#e8a24a',
}

export const initialClothes: Clothing[] = [
  { id: 'c1', type: '반팔', thickness: '얇음', color: '흰색', windproof: false, waterproof: false },
  { id: 'c2', type: '긴팔', thickness: '보통', color: '베이지', windproof: false, waterproof: false },
  { id: 'c3', type: '맨투맨', thickness: '보통', color: '회색', windproof: false, waterproof: false },
  { id: 'c4', type: '후드티', thickness: '두꺼움', color: '검정', windproof: false, waterproof: false },
  { id: 'c5', type: '바람막이', thickness: '얇음', color: '초록', windproof: true, waterproof: true },
  { id: 'c6', type: '패딩', thickness: '두꺼움', color: '검정', windproof: true, waterproof: false },
  { id: 'c7', type: '니트', thickness: '두꺼움', color: '기타', windproof: false, waterproof: false },
  { id: 'c8', type: '자켓', thickness: '보통', color: '파랑', windproof: true, waterproof: false },
  { id: 'c9', type: '바지', thickness: '보통', color: '파랑', windproof: false, waterproof: false },
  { id: 'c10', type: '치마', thickness: '얇음', color: '베이지', windproof: false, waterproof: false },
  { id: 'c11', type: '코트', thickness: '두꺼움', color: '베이지', windproof: true, waterproof: false },
]
