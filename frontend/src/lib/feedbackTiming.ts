// 후기 카드는 오늘 처음 추천을 확인하고 일정 시간이 지난 뒤에 홈에 뜬다.
// 지금은 모든 사용자에게 같은 간격. 이후 사용자 생활패턴(주로 앱을 여는 시간대)으로 조정할 수 있게 한 곳에 모아둔다.
export const FEEDBACK_DELAY_MS = 2.5 * 60 * 60 * 1000

interface RoutineLike {
  outAt: string | null
  days: number[]
}

/**
 * 후기 카드가 뜨는 시각. 기본은 처음 확인한 시각 + 2.5시간.
 * 오늘이 외출하는 요일이고 외출 시간을 알면, 집을 나선 시각보다 일찍 확인했더라도 나선 뒤 2.5시간 뒤로 미룬다.
 */
export function feedbackDueAt(firstSeen: number, routine: RoutineLike | undefined, now = new Date()): number {
  let anchor = firstSeen
  if (routine?.outAt && routine.days.includes(now.getDay())) {
    const [h, m] = routine.outAt.split(':').map(Number)
    const leave = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h!, m!).getTime()
    anchor = Math.max(anchor, leave)
  }
  return anchor + FEEDBACK_DELAY_MS
}

const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD (로컬)

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* 저장 불가면 이번 방문에서만 동작 */
  }
}

/** 오늘 첫 확인 시각을 기록(이미 있으면 유지)하고 돌려준다. 개발용: ?fb=now 면 바로 표시 */
export function firstSeenToday(): number {
  if (new URLSearchParams(location.search).get('fb') === 'now') return 0
  const key = `wb.firstSeen.${today()}`
  const saved = Number(read(key))
  if (saved) return saved
  const now = Date.now()
  write(key, String(now))
  return now
}

export const feedbackDoneKey = (recId: string) => `wb.feedbackDone.${recId}`
export const getFeedbackDone = (recId: string) => read(feedbackDoneKey(recId))
export const setFeedbackDone = (recId: string, rating: string) => write(feedbackDoneKey(recId), rating)
