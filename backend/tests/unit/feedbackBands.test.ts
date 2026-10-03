import { describe, expect, it } from 'vitest'
import { applyFeedback, averageOf, bandOfRecommendation, bandsOf } from '../../src/services/feedbackBands.js'
import { feedbackBandOf, judgeDetail, judgeTemperature, type OutingPoint } from '../../src/rules/outfitEngine.js'

const zero = { low: 0, mid: 0, high: 0 }
const pts = (temp: number): OutingPoint[] => [{ at: new Date('2026-10-02T00:00:00Z'), temp, feels: temp, pop: 10, precip: 'none', wind: 2 }]
const base = { sensitivity: 'NORMAL' as const, eventKind: null, feedbackOffset: 0 }

describe('feedbackBandOf', () => {
  it.each([[-5, 'low'], [9.9, 'low'], [10, 'mid'], [19.9, 'mid'], [20, 'high'], [30, 'high']] as const)('%d℃ -> %s', (t, b) => expect(feedbackBandOf(t)).toBe(b))
})

describe('기온대별 보정', () => {
  it('판단 기온대의 값만 적용한다', () => {
    const bands = { low: -2, mid: 0, high: 1 }
    expect(judgeDetail({ ...base, points: pts(5), feedbackBands: bands })).toEqual({ judged: 3, band: 'low', offset: -2 })
    expect(judgeTemperature({ ...base, points: pts(15), feedbackBands: bands })).toBe(15)
    expect(judgeTemperature({ ...base, points: pts(25), feedbackBands: bands })).toBe(26)
  })
  it('기온대 값이 없으면 단일 보정을 그대로 쓴다', () => {
    expect(judgeTemperature({ ...base, feedbackOffset: -1, points: pts(15) })).toBe(14)
  })
  it('보정 전 기온으로 기온대를 정한다(보정이 기온대를 옮기지 않는다)', () => {
    // 20℃에서 -2 보정을 받아 18이 돼도 기온대는 high 그대로
    expect(judgeDetail({ ...base, points: pts(20), feedbackBands: { low: 0, mid: 0, high: -2 } })).toMatchObject({ judged: 18, band: 'high' })
  })
})

describe('applyFeedback', () => {
  it('추웠어요는 그 기온대만 낮춘다', () => {
    expect(applyFeedback(zero, 'low', 'COLD', [])).toEqual({ low: -0.5, mid: 0, high: 0 })
  })
  it('더웠어요는 올린다', () => {
    expect(applyFeedback(zero, 'high', 'HOT', [])).toEqual({ low: 0, mid: 0, high: 0.5 })
  })
  it('딱 좋아요는 값을 바꾸지 않는다', () => {
    const b = { low: -1, mid: 0.5, high: 0 }
    expect(applyFeedback(b, 'mid', 'OK', ['COLD'])).toBe(b)
  })
  it('최근에 딱 좋아요가 많을수록 조정 폭이 줄어든다(최소 40%)', () => {
    expect(applyFeedback(zero, 'mid', 'COLD', ['OK', 'OK']).mid).toBe(-0.35)
    expect(applyFeedback(zero, 'mid', 'COLD', ['OK', 'OK', 'OK', 'OK', 'OK']).mid).toBe(-0.2)
  })
  it('최근 5개만 본다', () => {
    expect(applyFeedback(zero, 'mid', 'COLD', ['COLD', 'COLD', 'COLD', 'COLD', 'COLD', 'OK', 'OK']).mid).toBe(-0.5)
  })
  it('±3 한계를 넘지 않는다', () => {
    expect(applyFeedback({ ...zero, low: -2.9 }, 'low', 'COLD', []).low).toBe(-3)
  })
})

describe('bandsOf / averageOf / bandOfRecommendation', () => {
  it('비었거나 잘못된 값은 0, 한계 밖은 잘라낸다', () => {
    expect(bandsOf({ feedbackBandsJson: {} })).toEqual(zero)
    expect(bandsOf({ feedbackBandsJson: { low: 'x', mid: 9, high: -9 } })).toEqual({ low: 0, mid: 3, high: -3 })
  })
  it('평균', () => expect(averageOf({ low: -1, mid: 0, high: 0.5 })).toBe(-0.17))
  it('저장된 기온대가 없으면 판단 기온으로 구한다', () => {
    expect(bandOfRecommendation({ feedbackBand: 'high', judgedTemp: 5 })).toBe('high')
    expect(bandOfRecommendation({ judgedTemp: 5 })).toBe('low')
  })
})
