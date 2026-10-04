import { describe, expect, it } from 'vitest'
import { decideQuota, quotaCode, quotaMessage, type QuotaConfig } from '../../src/services/ai/aiQuota.js'

const config: QuotaConfig = { daily: { photo: 100, text: 50 }, newUser: { photo: 300, text: 200 }, newUserHours: 24 }
const now = new Date('2026-10-10T12:00:00Z')
const ago = (h: number) => new Date(now.getTime() - h * 3600_000)

describe('하루 사용량 한도', () => {
  it('일반 사용자: 하루 한도 미만이면 허용, 한도에 닿으면 막는다', () => {
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(24 * 30), now, used24h: 99, config })).toMatchObject({ ok: true, limit: 100, isNewUser: false })
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(24 * 30), now, used24h: 100, config })).toMatchObject({ ok: false, limit: 100 })
  })
  it('가입 직후(24시간 안)에는 보너스 한도를 쓴다', () => {
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(2), now, used24h: 250, config })).toMatchObject({ ok: true, limit: 300, isNewUser: true })
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(2), now, used24h: 300, config })).toMatchObject({ ok: false })
  })
  it('보너스 기간이 지나면 일반 한도로 돌아간다', () => {
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(25), now, used24h: 150, config })).toMatchObject({ ok: false, limit: 100, isNewUser: false })
  })
  it('사진과 말은 한도가 따로다', () => {
    expect(decideQuota({ kind: 'text', userCreatedAt: ago(24 * 30), now, used24h: 50, config })).toMatchObject({ ok: false, limit: 50 })
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(24 * 30), now, used24h: 50, config }).ok).toBe(true)
  })
  it('보너스가 일반 한도보다 작게 설정돼도 일반 한도보다 낮아지지 않는다', () => {
    const odd: QuotaConfig = { ...config, newUser: { photo: 10, text: 10 } }
    expect(decideQuota({ kind: 'photo', userCreatedAt: ago(1), now, used24h: 50, config: odd })).toMatchObject({ ok: true, limit: 100 })
  })
  it('안내 문장은 짧게, 종류에 맞는 코드', () => {
    expect(quotaMessage('photo')).toBe('오늘 사진 인식은 다 썼어요. 내일 다시 쓸 수 있어요.')
    expect(quotaMessage('text')).toBe('오늘 말로 입력은 다 썼어요. 내일 다시 쓸 수 있어요.')
    expect(quotaCode('photo')).toBe('PHOTO_DAILY_LIMIT')
    expect(quotaCode('text')).toBe('AI_DAILY_LIMIT')
  })
})
