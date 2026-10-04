import { describe, expect, it } from 'vitest'
import { avgMsByKind, buildDays, failureRate, type UsageRow } from '../../src/services/ai/aiUsageReport.js'

// 2026-10-10 12:00 KST
const now = new Date('2026-10-10T03:00:00Z')
const row = (d: string, kind: string | null, status: 'SUCCESS' | 'FAILED', c: number, avgMs: number | null = null): UsageRow => ({ d, kind, status, c, avgMs })

describe('AI 사용 현황', () => {
  it('최근 7일을 날짜순으로 채우고, 기록 없는 날은 0', () => {
    const days = buildDays([], 7, now)
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(days.every((d) => d.total === 0)).toBe(true)
  })
  it('종류별(사진/말/그 밖)로 모으고 실패도 센다', () => {
    const days = buildDays(
      [row('2026-10-10', 'photo', 'SUCCESS', 8), row('2026-10-10', 'photo', 'FAILED', 2), row('2026-10-10', 'text', 'SUCCESS', 5), row('2026-10-10', null, 'SUCCESS', 3), row('2026-10-09', 'text', 'SUCCESS', 1)],
      7,
      now,
    )
    const today = days.at(-1)!
    expect(today).toMatchObject({ photo: 10, text: 5, other: 3, total: 18, failed: 2 })
    expect(days.at(-2)).toMatchObject({ text: 1, total: 1 })
  })
  it('범위 밖 날짜는 무시한다', () => {
    expect(buildDays([row('2026-09-01', 'photo', 'SUCCESS', 99)], 7, now).every((d) => d.total === 0)).toBe(true)
  })
  it('실패 비율(%)', () => {
    const days = buildDays([row('2026-10-10', 'photo', 'SUCCESS', 9), row('2026-10-10', 'photo', 'FAILED', 1)], 7, now)
    expect(failureRate(days)).toBe(10)
    expect(failureRate(buildDays([], 7, now))).toBeNull()
  })
  it('종류별 평균 응답 시간은 건수로 가중한다', () => {
    const r = avgMsByKind([row('2026-10-10', 'photo', 'SUCCESS', 3, 1000), row('2026-10-09', 'photo', 'SUCCESS', 1, 2000), row('2026-10-10', 'text', 'SUCCESS', 2, 500)])
    expect(r).toEqual({ photo: 1250, text: 500 })
    expect(avgMsByKind([])).toEqual({ photo: null, text: null })
  })
})
