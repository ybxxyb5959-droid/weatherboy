// 추천 Rule Engine 설정값. 모든 수치는 MVP Draft이며 사용자 피드백/실측으로 조정 예정.
import type { ClothingType, EventKind, Sensitivity, Thickness } from '@prisma/client'

export const ruleConfig = {
  // 개인 체감 보정(℃). 추천 판단용 체감온도에 더한다.
  sensitivityOffset: { COLD: -2, NORMAL: 0, HOT: 2 } as Record<Sensitivity, number>,

  // 피드백 보정(추웠어요 -0.5 / 더웠어요 +0.5), 누적 한계
  feedbackStep: { COLD: -0.5, OK: 0, HOT: 0.5 } as Record<'COLD' | 'OK' | 'HOT', number>,
  feedbackOffsetLimit: 3,
  // 보정은 기온대마다 따로 쌓는다: 추위는 타도 더위는 안 타는 사람이 있어서. 기준은 보정 전 판단 기온(체감 + 감도 + 일정 보정).
  feedbackBandLowBelow: 10, // 이 미만이면 '낮음'
  feedbackBandHighFrom: 20, // 이 이상이면 '높음', 그 사이는 '보통'
  // 최근 후기 중 '딱 좋아요'가 많을수록 다음 조정 폭을 줄인다(출렁임 방지). 폭 = 기본 폭 x max(min, 1 - perOk x 딱 좋아요 수)
  feedbackDampenWindow: 5,
  feedbackDampenPerOk: 0.15,
  feedbackDampenMin: 0.4,

  // 기본 보온 점수
  baseWarmth: {
    SHORT_SLEEVE: 1,
    LONG_SLEEVE: 2,
    SHIRT: 1.5, // 얇은 면 셔츠: 반팔(1)과 긴팔(2) 사이
    SHORT_SLEEVE_SHIRT: 1.2, // 반팔 셔츠: 깃이 있어 반팔티보다 살짝 더
    SWEATSHIRT: 2,
    HOODIE: 2,
    KNIT: 3,
    WINDBREAKER: 2,
    JACKET: 3,
    CARDIGAN: 2, // 얇게 걸치는 겉옷
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
  // 같은 날 비슷하게 알맞은 조합이 여러 개면, 가장 가벼운 조합보다 이만큼(보온 점수)까지는 후보로 보고 날짜마다 돌아가며 고른다
  varietyWarmthSlack: 2,
  // 겉옷을 걸친 조합도 후보에 넣는 최소 필요 보온(선선한 날부터). 더운 날에 가디건을 걸치는 일이 없게 한다
  varietyOuterMinRequired: 4,
  // 이 기간(일) 안에 추가한 옷이 들어간 조합을 우선한다(새로 담은 옷이 바로 추천에 보이게)
  newItemDays: 3,
  // 알맞은 조합이 전부 필요 보온보다 이 점수 넘게 두꺼운데, 이 점수 안으로 조금 모자란 조합이 있으면 두꺼운 것 대신 모자란 쪽을 고르고 '딱 맞는 옷이 부족'으로 알린다
  maxOvershoot: 4,
  // 두꺼운 겉옷은 충분히 추울 때만 쓴다(필요 보온 기준: 6 = 판단 기온 17℃ 미만, 10 = 9℃ 미만). 그보다 따뜻한 날에는 옷장에 있어도 추천하지 않는다
  coatMinRequired: 6,
  paddingMinRequired: 10,
  // 두꺼운 겉옷은 계절과 낮 기온도 본다: 외출 시간대의 최고 기온이 이 값을 넘으면(낮에 따뜻하면) 쓰지 않고, 철이 아니면 쓰지 않는다.
  // 판단 기온이 아주 낮으면(필요 보온 veryColdRequired 이상, 약 5℃ 미만) 철과 상관없이 허용한다.
  paddingMaxDayTemp: 15,
  coatMaxDayTemp: 20,
  paddingMonths: [11, 12, 1, 2, 3],
  coatMonths: [10, 11, 12, 1, 2, 3, 4],
  veryColdRequired: 13,
  maxShortfall: 4,
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
