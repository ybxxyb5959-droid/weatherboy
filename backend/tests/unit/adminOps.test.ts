import { describe, expect, it } from 'vitest'
import type { ClothingColor, ClothingPattern, ClothingType, Thickness } from '@prisma/client'
import { buildChecks, vapidSubjectProblem, type EnvLike } from '../../src/services/admin/opsChecks.js'
import { activeDaysBuckets, retentionOf, titleDistribution } from '../../src/services/admin/insights.js'
import { TITLES } from '../../src/services/character/analysis.js'

const env: EnvLike = {
  NODE_ENV: 'production',
  KAKAO_REST_API_KEY: 'k-secret-1',
  KAKAO_LOCAL_REST_API_KEY: '',
  KAKAO_CLIENT_SECRET: 'k-secret-2',
  KAKAO_REDIRECT_URI: 'https://x/cb',
  KMA_SERVICE_KEY: 'kma-secret',
  AIRKOREA_SERVICE_KEY: 'air-secret',
  VAPID_PUBLIC_KEY: 'pub-secret',
  VAPID_PRIVATE_KEY: 'priv-secret',
  VAPID_SUBJECT: 'mailto:a@b.com',
  AI_ENABLED: true,
  GEMINI_API_KEY: 'gem-secret',
  GEMINI_MODEL: 'm',
  RUN_JOBS_IN_API: true,
  ADMIN_PASSWORD: 'admin-secret',
  DISCORD_WEBHOOK_URL: '',
}
const now = new Date('2026-10-05T12:00:00Z')
const by = (checks: ReturnType<typeof buildChecks>, key: string) => checks.find((c) => c.key === key)!

describe('VAPID_SUBJECT 검사', () => {
  it.each(['mailto:me@example.com', 'https://example.com/contact'])('%s 은 올바르다', (v) => {
    expect(vapidSubjectProblem(v)).toBeNull()
  })
  it.each(['', 'me@example.com', 'mailto:', 'http://example.com', 'mailto:a b@c.com'])('"%s" 은 문제가 있다', (v) => {
    expect(vapidSubjectProblem(v)).not.toBeNull()
  })
})

describe('시스템 점검 항목', () => {
  const ok = { dbOk: true, dbMs: 12, lastCollectAt: new Date('2026-10-05T11:30:00Z'), now }

  it('모든 설정이 있으면 필수 항목은 모두 정상이고, 선택 항목(디스코드)만 꺼짐으로 나온다', () => {
    const checks = buildChecks(env, ok)
    expect(checks.filter((c) => !c.ok && !c.optional)).toEqual([])
    expect(checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['discord'])
    expect(by(checks, 'discord').optional).toBe(true)
  })

  it('이메일만 쓴 VAPID_SUBJECT 는 알림 점검이 실패하고 이유를 알려준다', () => {
    const c = by(buildChecks({ ...env, VAPID_SUBJECT: 'me@example.com' }, ok), 'push')
    expect(c.ok).toBe(false)
    expect(c.note).toContain('mailto:')
  })

  it('키가 없거나 AI 가 꺼져 있으면 해당 항목이 실패한다', () => {
    const checks = buildChecks({ ...env, KMA_SERVICE_KEY: '', AI_ENABLED: false, ADMIN_PASSWORD: '' }, ok)
    expect(by(checks, 'kma').ok).toBe(false)
    expect(by(checks, 'ai').ok).toBe(false)
    expect(by(checks, 'admin').ok).toBe(false)
  })

  it('수집 기록이 6시간 넘게 없거나 아예 없으면 예약 작업이 멈춘 것으로 본다', () => {
    expect(by(buildChecks(env, { ...ok, lastCollectAt: new Date('2026-10-05T04:00:00Z') }), 'jobs').ok).toBe(false)
    expect(by(buildChecks(env, { ...ok, lastCollectAt: null }), 'jobs').ok).toBe(false)
    expect(by(buildChecks(env, ok), 'jobs').ok).toBe(true)
  })

  it('DB 가 안 되면 실패한다', () => {
    expect(by(buildChecks(env, { ...ok, dbOk: false, dbMs: null }), 'db').ok).toBe(false)
  })

  it('결과에 키·비밀번호 값은 절대 들어가지 않는다', () => {
    const text = JSON.stringify(buildChecks(env, ok))
    for (const secret of ['k-secret-1', 'k-secret-2', 'kma-secret', 'air-secret', 'pub-secret', 'priv-secret', 'gem-secret', 'admin-secret']) {
      expect(text).not.toContain(secret)
    }
  })
})

describe('재방문율(근사)', () => {
  const d = (s: string) => new Date(s)
  it('가입 후 N일이 안 지난 사용자는 세지 않는다', () => {
    const r = retentionOf([{ createdAt: d('2026-10-05T00:00:00Z'), lastSeenAt: d('2026-10-05T10:00:00Z') }], 1, now)
    expect(r).toEqual({ eligible: 0, returned: 0, rate: null })
  })
  it('마지막 접속이 가입 N일 뒤 이후인 사람만 재방문으로 본다', () => {
    const rows = [
      { createdAt: d('2026-10-01T00:00:00Z'), lastSeenAt: d('2026-10-03T00:00:00Z') }, // 재방문
      { createdAt: d('2026-10-01T00:00:00Z'), lastSeenAt: d('2026-10-01T05:00:00Z') }, // 당일만
      { createdAt: d('2026-10-02T00:00:00Z'), lastSeenAt: null },
      { createdAt: d('2026-10-03T00:00:00Z'), lastSeenAt: d('2026-10-04T00:00:00Z') }, // 정확히 1일 뒤 = 재방문
    ]
    expect(retentionOf(rows, 1, now)).toEqual({ eligible: 4, returned: 2, rate: 50 })
    expect(retentionOf(rows, 7, now)).toEqual({ eligible: 0, returned: 0, rate: null })
  })
})

describe('접속일수 분포', () => {
  it('1 / 2 / 3~6 / 7+ 로 나눈다', () => {
    expect(activeDaysBuckets([1, 1, 2, 3, 6, 7, 30])).toEqual([
      { label: '1일', count: 2 },
      { label: '2일', count: 1 },
      { label: '3~6일', count: 2 },
      { label: '7일 이상', count: 2 },
    ])
  })
})

describe('칭호 분포', () => {
  const c = (type: ClothingType, color: ClothingColor, pattern: ClothingPattern = 'SOLID', thickness: Thickness = 'NORMAL') => ({ type, color, pattern, thickness })
  it('열리기 전(옷 10벌 미만) 사용자는 분석하지 않고, 희귀/취향/없음을 나눠 센다', () => {
    const rareCloset = Array.from({ length: 10 }, () => c('HOODIE', 'BLACK'))
    const tasteCloset = [c('LONG_SLEEVE', 'BLACK'), c('SHORT_SLEEVE', 'WHITE'), c('SWEATSHIRT', 'GRAY'), c('PANTS', 'NAVY'), c('PANTS', 'BEIGE'), c('SHORTS', 'BLUE'), c('SHIRT', 'SKYBLUE'), c('KNIT', 'BROWN'), c('JACKET', 'KHAKI'), c('CARDIGAN', 'RED'), c('PANTS', 'GREEN')]
    const small = [c('PANTS', 'BLACK')]
    const d = titleDistribution([rareCloset, tasteCloset, small])
    expect(d.analyzed).toBe(2)
    expect(d.rare.find((r) => r.key === 'HOODIE_ADDICT')?.count).toBe(1)
    expect(d.taste).toEqual({ total: 1, color: 0, type: 1, pattern: 0 })
    expect(d.none).toBe(0)
    expect(d.rare).toHaveLength(TITLES.length)
  })
})
