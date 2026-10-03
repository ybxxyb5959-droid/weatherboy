import { describe, expect, it } from 'vitest'
import { nextSnooze, shouldPromptReview, touchActivity, usedAllFeatures } from '../../src/services/review/reviewPrompt.js'

const now = new Date('2026-10-05T03:00:00Z') // 12:00 KST
// 가입한 지 13시간 지난 사용자
const base = { createdAt: new Date('2026-10-04T14:00:00Z'), usedAll: false, reviewed: false, dismissed: false, snoozeUntil: null }

describe('후기 요청 카드를 보여줄 조건', () => {
  it('가입 후 12시간이 지났고 아직 안 썼으면 보여준다', () => expect(shouldPromptReview(base, now)).toBe(true))
  it('가입한 지 12시간이 안 됐으면 보여주지 않는다', () => expect(shouldPromptReview({ ...base, createdAt: new Date('2026-10-05T00:00:00Z') }, now)).toBe(false))
  it('12시간이 안 됐어도 주요 기능을 다 써봤으면 보여준다', () => expect(shouldPromptReview({ ...base, createdAt: new Date('2026-10-05T00:00:00Z'), usedAll: true }, now)).toBe(true))
  it('후기를 썼으면 다시는 보여주지 않는다', () => expect(shouldPromptReview({ ...base, reviewed: true }, now)).toBe(false))
  it('다시 안 볼래요를 눌렀으면 보여주지 않는다', () => expect(shouldPromptReview({ ...base, dismissed: true }, now)).toBe(false))
  it('나중에 기간 안에는 보여주지 않고, 지나면 다시 보여준다', () => {
    expect(shouldPromptReview({ ...base, snoozeUntil: new Date('2026-10-06T00:00:00Z') }, now)).toBe(false)
    expect(shouldPromptReview({ ...base, snoozeUntil: new Date('2026-10-05T02:59:00Z') }, now)).toBe(true)
  })
})

describe('나중에 누르기', () => {
  it('처음 두 번은 3일 뒤로 미룬다', () => {
    const a = nextSnooze(0, now)
    expect(a).toMatchObject({ snoozeCount: 1, dismissed: false })
    expect(a.snoozeUntil!.getTime() - now.getTime()).toBe(3 * 24 * 3600_000)
    expect(nextSnooze(1, now)).toMatchObject({ snoozeCount: 2, dismissed: false })
  })
  it('세 번째부터는 더 묻지 않는다', () => expect(nextSnooze(2, now)).toMatchObject({ snoozeCount: 3, dismissed: true, snoozeUntil: null }))
})

describe('접속 기록 갱신', () => {
  it('처음이면 갱신', () => expect(touchActivity(null, 1, now)).toEqual({ update: true, activeDays: 1 }))
  it('한국 시간으로 다른 날이면 접속 일수 +1', () => {
    // 10/04 23:50 KST -> 10/05 00:10 KST (UTC 날짜는 같은 4일)
    expect(touchActivity(new Date('2026-10-04T14:50:00Z'), 2, new Date('2026-10-04T15:10:00Z'))).toEqual({ update: true, activeDays: 3 })
  })
  it('같은 날 30분 안이면 갱신하지 않는다', () => expect(touchActivity(new Date('2026-10-05T02:45:00Z'), 3, now)).toEqual({ update: false, activeDays: 3 }))
  it('같은 날 30분 넘으면 시각만 갱신(일수 그대로)', () => expect(touchActivity(new Date('2026-10-05T02:00:00Z'), 3, now)).toEqual({ update: true, activeDays: 3 }))
})

describe('주요 기능을 다 써봤는가', () => {
  it('옷 5벌 + 일정 + 캐릭터 꾸미기', () => expect(usedAllFeatures({ ownClothes: 5, events: 1, decorated: true })).toBe(true))
  it('하나라도 빠지면 아니다', () => {
    expect(usedAllFeatures({ ownClothes: 4, events: 1, decorated: true })).toBe(false)
    expect(usedAllFeatures({ ownClothes: 5, events: 0, decorated: true })).toBe(false)
    expect(usedAllFeatures({ ownClothes: 5, events: 1, decorated: false })).toBe(false)
  })
})
