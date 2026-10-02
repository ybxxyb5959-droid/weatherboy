// frontend/src/mocks/clothes.ts 의 initialClothes 11벌과 동일 (closetMode=sample)
import type { clothingTypeMap, colorMap, thicknessMap } from './mappings.js'

type Sample = {
  type: Parameters<typeof clothingTypeMap.toDb>[0]
  thickness: Parameters<typeof thicknessMap.toDb>[0]
  color: Parameters<typeof colorMap.toDb>[0]
  windproof: boolean
  waterproof: boolean
}

export const sampleClothes: Sample[] = [
  { type: '반팔', thickness: '얇음', color: '흰색', windproof: false, waterproof: false },
  { type: '긴팔', thickness: '보통', color: '베이지', windproof: false, waterproof: false },
  { type: '맨투맨', thickness: '보통', color: '회색', windproof: false, waterproof: false },
  { type: '후드티', thickness: '두꺼움', color: '검정', windproof: false, waterproof: false },
  { type: '바람막이', thickness: '얇음', color: '초록', windproof: true, waterproof: true },
  { type: '패딩', thickness: '두꺼움', color: '검정', windproof: true, waterproof: false },
  { type: '니트', thickness: '두꺼움', color: '기타', windproof: false, waterproof: false },
  { type: '자켓', thickness: '보통', color: '파랑', windproof: true, waterproof: false },
  { type: '바지', thickness: '보통', color: '파랑', windproof: false, waterproof: false },
  { type: '치마', thickness: '얇음', color: '베이지', windproof: false, waterproof: false },
  { type: '코트', thickness: '두꺼움', color: '베이지', windproof: true, waterproof: false },
]
