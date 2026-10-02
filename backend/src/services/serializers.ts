import type { AuthIdentity, Clothing, Event, User } from '@prisma/client'
import { clothingTypeMap, colorMap, eventKindMap, sensitivityMap, thicknessMap, patternMap } from '../config/mappings.js'
import { kstDate, kstTime } from '../utils/time.js'

export function serializeSettings(u: User) {
  return {
    sensitivity: sensitivityMap.toUi(u.sensitivity),
    location: u.locationName,
    locationResolved: u.gridNx != null && u.gridNy != null,
    notifyEvent: u.notifyEvent,
    notifyChange: u.notifyChange,
    routine: { outAt: u.routineOutAt, homeAt: u.routineHomeAt, days: u.routineDays },
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
  }
}
