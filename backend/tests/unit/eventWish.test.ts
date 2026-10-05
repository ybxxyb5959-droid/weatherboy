import { describe, expect, it, vi } from 'vitest'
vi.mock('../../src/db.js', () => ({ prisma: {} }))
import { applyEventWish, conditionForDate, eventDates, parseEventWishRules, savedEventWish } from '../../src/rules/eventWish.js'

const dates = ['2026-10-05', '2026-10-06']
const blank = () => savedEventWish(null)
const apply = (text: string, plan = blank()) => {
  const parsed = parseEventWishRules(text, dates)
  expect(parsed?.question).toBeUndefined()
  expect(parsed).not.toBeNull()
  return applyEventWish(plan, parsed!.patches, dates)
}
describe('날짜별 말 입력과 부분 수정', () => {
  it('첫날 밝게, 둘째날 어둡게를 각각 저장한다', () => {
    const plan = apply('첫날은 밝게 둘째날은 어둡게')
    expect(conditionForDate(plan, dates[0]!).pieces.map((p) => p.tone)).toEqual(['light', 'light'])
    expect(conditionForDate(plan, dates[1]!).pieces.map((p) => p.tone)).toEqual(['dark', 'dark'])
  })
  it('첫날만 다시 지정하면 둘째 날과 언급하지 않은 옷 종류는 그대로다', () => {
    let plan = apply('첫날 니트, 둘째날 어둡게')
    plan = apply('첫날 밝게', plan)
    expect(conditionForDate(plan, dates[0]!).pieces[0]).toMatchObject({ type: '니트', tone: 'light' })
    expect(conditionForDate(plan, dates[1]!).pieces.map((p) => p.tone)).toEqual(['dark', 'dark'])
  })
  it('하의 수정은 상의를 지우지 않고 색/톤 변경은 상충 속성을 지운다', () => {
    let plan = apply('첫날 검정 상의')
    plan = apply('첫날 하의 밝게', plan)
    expect(conditionForDate(plan, dates[0]!).pieces).toHaveLength(2)
    plan = apply('첫날 상의 밝게', plan)
    expect(conditionForDate(plan, dates[0]!).pieces[0]).toMatchObject({ tone: 'light' })
    expect(conditionForDate(plan, dates[0]!).pieces[0]!.color).toBeUndefined()
  })
  it('전체 요청은 모든 날짜의 해당 속성만 바꾼다', () => {
    let plan = apply('첫날 밝게, 둘째날 어둡게')
    plan = apply('이틀 다 밝게', plan)
    for (const date of dates) expect(conditionForDate(plan, date).pieces.map((p) => p.tone)).toEqual(['light', 'light'])
  })
  it('날짜별 취소와 전체 초기화를 구분한다', () => {
    let plan = apply('첫날 밝게, 둘째날 어둡게')
    plan = apply('첫날 취소', plan)
    expect(conditionForDate(plan, dates[0]!).pieces).toEqual([])
    expect(conditionForDate(plan, dates[1]!).pieces).toHaveLength(2)
    expect(apply('전체 초기화', plan)).toEqual(blank())
  })
  it.each(['검정 말고 흰색으로', '첫날은 밝게 둘째날은 검정 말고 흰색으로', '그날 하의만 바꿔줘', '니트는 싫어', '상의는 밝게 하의는 어둡게'])('일부 키워드만 알아들은 %s는 규칙으로 처리하지 않는다', (text) => {
    expect(parseEventWishRules(text, dates)).toBeNull()
  })
  it('일정 밖 날짜는 변경하지 않고 확인한다', () => {
    expect(parseEventWishRules('셋째날 밝게', dates)?.patches).toEqual([])
    expect(parseEventWishRules('셋째날 밝게', dates)?.question).toBeTruthy()
    expect(() => applyEventWish(blank(), [{ date: '2026-10-07', condition: { pieces: [] } }], dates)).toThrow()
  })
  it('실제 날짜, 숫자 일차, 마지막날도 같은 날짜로 바꾼다', () => {
    for (const text of ['2일차 어둡게', '마지막날 어둡게', '2026-10-06 어둡게']) expect(apply(text).days[dates[1]!]?.pieces[0]?.tone).toBe('dark')
  })
  it('예전 저장 형식과 KST 날짜를 지원한다', () => {
    expect(savedEventWish({ suit: false, pieces: [{ role: 'top', color: '검정' }] }).all.pieces[0]?.color).toBe('검정')
    expect(eventDates({ startAt: new Date('2026-10-04T23:00:00Z'), endAt: new Date('2026-10-06T10:00:00Z') })).toEqual(dates)
  })
})
