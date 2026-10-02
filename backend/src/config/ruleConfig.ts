// 추천 Rule Engine 설정값. 모든 수치는 MVP Draft이며 사용자 피드백/실측으로 조정 예정.
import type { ClothingType, EventKind, Sensitivity, Thickness } from '@prisma/client'

export const ruleConfig = {
  // 개인 체감 보정(℃). 추천 판단용 체감온도에 더한다.
  sensitivityOffset: { COLD: -2, NORMAL: 0, HOT: 2 } as Record<Sensitivity, number>,

  // 피드백 보정(추웠어요 -0.5 / 더웠어요 +0.5), 누적 한계
  feedbackStep: { COLD: -0.5, OK: 0, HOT: 0.5 } as Record<'COLD' | 'OK' | 'HOT', number>,
  feedbackOffsetLimit: 3,

  // 기본 보온 점수
  baseWarmth: {
    SHORT_SLEEVE: 1,
    LONG_SLEEVE: 2,
    SWEATSHIRT: 2,
    HOODIE: 2,
    KNIT: 3,
    WINDBREAKER: 2,
    JACKET: 3,
    COAT: 5,
    PADDING: 7,
    // 하의 (MVP Draft)
    SHORTS: 0.5,
    SKIRT: 1,
    PANTS: 2,
  } as Record<ClothingType, number>,

  thicknessAdjust: { THIN: -0.5, NORMAL: 0, THICK: 1 } as Record<Thickness, number>,

  // 필요 보온 점수 (판단 기온 >= minTemp 이면 required)
  requiredWarmth: [
    { minTemp: 28, required: 1 },
    { minTemp: 23, required: 2 },
    { minTemp: 20, required: 3 },
    { minTemp: 17, required: 4 },
    { minTemp: 12, required: 6 },
    { minTemp: 9, required: 8 },
    { minTemp: 5, required: 10 },
    { minTemp: -Infinity, required: 13 },
  ],

  // 일정 유형 보정(℃, 판단 기온에 더함). 등산은 움직이면 더워지지만 산 위는 더 추워서 +1 이면서 최저 기온 비중을 높였다.
  eventTempAdjust: { COMMUTE: 0, OTHER: 0, TRAVEL: 0, CAMPING: -2, EXERCISE: 2, HIKING: 1, OUTDOOR: 0 } as Record<EventKind, number>,

  // 큰 일교차 기준(℃). 하루 최저/최고 차
  largeDiurnalRange: 10,
  // 일정/외출 구간 중 최저와 평균을 섞는 가중(최저 비중) - 캠핑은 더 높음
  minTempWeight: { COMMUTE: 0.3, OTHER: 0.3, TRAVEL: 0.5, CAMPING: 0.7, EXERCISE: 0.3, HIKING: 0.6, OUTDOOR: 0.5 } as Record<EventKind, number>,

  umbrellaPopThreshold: 60,
  windStrongMs: 7, // 방풍 옷 우선 기준 (m/s)
  maskMinGrade: 3, // AirKorea 3=나쁨, 4=매우나쁨
  outerWarmthMin: 2, // 겉옷 필요 판단: 필요 보온 - (상의+하의) > 0
  alternativesCount: 3,
}

export const dustGradeLabel: Record<number, string> = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' }

export function windLabel(ms: number): string {
  if (ms < 1) return '고요함'
  if (ms < 4) return '약함'
  if (ms < 9) return '약간 강함'
  if (ms < 14) return '강함'
  return '매우 강함'
}

export const notifyConfig = {
  maxPerEvent: 3, // 일정당 최대 Push 횟수 (MVP Draft: 최초 생성 / 판단 변경 / 최종 갱신)
  eventLookaheadDays: 11, // 중기예보 범위(+10일)까지 점검
}
