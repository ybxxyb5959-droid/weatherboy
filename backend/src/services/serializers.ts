import type { AuthIdentity, Clothing, Event, User } from '@prisma/client'
import { clothingTypeMap, colorMap, eventKindMap, sensitivityMap, thicknessMap, patternMap } from '../config/mappings.js'
import { bandsOf } from './feedbackBands.js'
import { eventModeOf } from '../rules/eventMode.js'
import { kstDate, kstTime } from '../utils/time.js'

export function serializeSettings(u: User) {
  return {
    sensitivity: sensitivityMap.toUi(u.sensitivity),
    location: u.locationName,
    locationResolved: u.gridNx != null && u.gridNy != null,
    notifyEvent: u.notifyEvent,
    notifyChange: u.notifyChange,
    notifyMorning: u.notifyMorning,
    notifyRain: u.notifyRain,
    notifyColdReturn: u.notifyColdReturn,
    notifyDust: u.notifyDust,
    notifyFeedback: u.notifyFeedback,
    notifyCloset: u.notifyCloset,
    notifyNotice: u.notifyNotice,
    morningLeadMin: u.morningLeadMin,
    quiet: { enabled: u.quietEnabled, start: u.quietStart, end: u.quietEnd },
    routine: { outAt: u.routineOutAt, homeAt: u.routineHomeAt, days: u.routineDays },
    // 후기로 배운 기온대별 체감 보정(℃). 음수면 더 춥게, 양수면 더 덥게 느끼는 걸로 반영 중
    feel: bandsOf(u),
  }
}

export function serializeMe(u: User, identities: AuthIdentity[]) {
  // Kakao 가 연결되어 있으면 Kakao 를 대표 provider 로 노출
  const primary = identities.find((i) => i.provider === 'KAKAO') ?? identities[0]
  return {
    id: u.id,
    provider: primary?.provider ?? null,
    nickname: primary?.nickname ?? null,
    profileImageUrl: primary?.profileImageUrl ?? null,
    plan: u.plan,
    onboardingDone: u.onboardingDone,
  }
}

export function serializeClothing(c: Clothing) {
  return {
    id: c.id,
    type: clothingTypeMap.toUi(c.type),
    thickness: thicknessMap.toUi(c.thickness),
    color: colorMap.toUi(c.color),
    pattern: patternMap.toUi(c.pattern),
    windproof: c.windproof,
    waterproof: c.waterproof,
    isSample: c.isSample,
  }
}

export function serializeEvent(e: Event) {
  const mode = eventModeOf(e.kind, e.title)
  const startDate = kstDate(e.startAt)
  const endDate = kstDate(e.endAt)
  return {
    id: e.id,
    title: e.title,
    startDate,
    ...(endDate !== startDate ? { endDate } : {}),
    place: e.placeName,
    startTime: kstTime(e.startAt),
    endTime: kstTime(e.endAt),
    kind: eventKindMap.toUi(e.kind),
    // frontend 호환: 예보 단계가 WAITING 이거나 아직 추천이 없으면 waiting
    status: e.forecastStage !== 'WAITING' && e.recommendationVersion > 0 ? ('ready' as const) : ('waiting' as const),
    forecastStage: e.forecastStage,
    locationResolved: e.gridNx != null,
    imported: e.calendarConnectionId != null,
    /** 무엇을 보여줄까: outfit 옷차림 / activity 야외활동 점수 / weather 날씨만 (종류와 제목으로 정해진다) */
    mode,
    /** 예전 앱 호환: mode 가 outfit 일 때만 true */
    needsOutfit: mode === 'outfit',
  }
}
