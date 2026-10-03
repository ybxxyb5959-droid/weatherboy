import { kstDate } from '../../utils/time.js'

// 앱 후기 요청 카드를 언제 보여줄지에 대한 규칙(순수 함수라 DB 없이 테스트할 수 있다).
// - 서로 다른 3일 이상 접속한 사람에게만 묻는다. 안 쓰는 사람에게는 묻지 않는다.
// - 후기를 쓰면 영영 다시 묻지 않는다. 나중에: 3일 뒤에 다시(최대 2번), 그 뒤에는 묻지 않는다.
export const REVIEW_MIN_ACTIVE_DAYS = 3
export const REVIEW_SNOOZE_DAYS = 3
export const REVIEW_MAX_SNOOZES = 2

const DAY_MS = 24 * 3600_000
const TOUCH_INTERVAL_MS = 30 * 60_000 // 마지막 접속 시각은 이 간격으로만 갱신한다(쓰기를 줄이려고)

export interface ReviewPromptState {
  activeDays: number
  reviewed: boolean
  dismissed: boolean
  snoozeUntil: Date | null
}

export function shouldPromptReview(s: ReviewPromptState, now: Date): boolean {
  if (s.reviewed || s.dismissed) return false
  if (s.activeDays < REVIEW_MIN_ACTIVE_DAYS) return false
  if (s.snoozeUntil && s.snoozeUntil.getTime() > now.getTime()) return false
  return true
}

/** "나중에"를 눌렀을 때의 다음 상태. 두 번 미루면 더 묻지 않는다. */
export function nextSnooze(count: number, now: Date): { snoozeUntil: Date | null; snoozeCount: number; dismissed: boolean } {
  const snoozeCount = count + 1
  if (snoozeCount > REVIEW_MAX_SNOOZES) return { snoozeUntil: null, snoozeCount, dismissed: true }
  return { snoozeUntil: new Date(now.getTime() + REVIEW_SNOOZE_DAYS * DAY_MS), snoozeCount, dismissed: false }
}

/**
 * 접속 기록 갱신. 한국 시간 기준으로 오늘 처음 접속이면 접속 일수를 1 늘린다.
 * 같은 날에는 마지막 접속 시각만, 그것도 30분이 지났을 때만 갱신한다.
 */
export function touchActivity(lastSeenAt: Date | null, activeDays: number, now: Date): { update: boolean; activeDays: number } {
  if (!lastSeenAt) return { update: true, activeDays: Math.max(1, activeDays) }
  if (kstDate(lastSeenAt) !== kstDate(now)) return { update: true, activeDays: activeDays + 1 }
  if (now.getTime() - lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) return { update: true, activeDays }
  return { update: false, activeDays }
}
