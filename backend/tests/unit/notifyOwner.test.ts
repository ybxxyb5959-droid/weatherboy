import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { notifyNewReview, notifyNewSupport } from '../../src/services/review/notifyOwner.js'

describe('운영자 디스코드 알림: 후기·의견 본문', () => {
  let sent: string[] = []
  const saved = { url: env.DISCORD_WEBHOOK_URL, include: env.DISCORD_INCLUDE_MESSAGE }

  beforeEach(() => {
    sent = []
    env.DISCORD_WEBHOOK_URL = 'https://discord.test/hook'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push((JSON.parse(init.body) as { content: string }).content)
        return { ok: true, status: 204 }
      }),
    )
  })
  afterEach(() => {
    env.DISCORD_WEBHOOK_URL = saved.url
    env.DISCORD_INCLUDE_MESSAGE = saved.include
    vi.unstubAllGlobals()
  })

  it('기본은 본문을 보내지 않고 별점·종류·사용자 번호만 보낸다', async () => {
    env.DISCORD_INCLUDE_MESSAGE = false
    await notifyNewReview({ rating: 4, message: '비밀 후기 내용 abc', code: 'AB12CD34', provider: 'GUEST', total: 3 })
    await notifyNewSupport({ kind: 'BUG', message: '비밀 의견 내용 xyz', code: 'AB12CD34', provider: 'KAKAO' })
    expect(sent).toHaveLength(2)
    expect(sent[0]).toContain('★★★★☆')
    expect(sent[0]).toContain('AB12CD34')
    expect(sent[1]).toContain('불편/오류')
    expect(sent.join('\n')).not.toContain('비밀')
    expect(sent.join('\n')).toContain('관리자 화면')
  })

  it('DISCORD_INCLUDE_MESSAGE 를 켠 경우에만 본문이 들어간다', async () => {
    env.DISCORD_INCLUDE_MESSAGE = true
    await notifyNewReview({ rating: 5, message: '본문 포함 후기', code: 'AB12CD34', provider: null, total: 1 })
    await notifyNewSupport({ kind: 'IDEA', message: '본문 포함 의견', code: 'AB12CD34', provider: null })
    expect(sent[0]).toContain('본문 포함 후기')
    expect(sent[1]).toContain('본문 포함 의견')
  })

  it('웹훅 주소가 없으면 아무것도 보내지 않는다', async () => {
    env.DISCORD_WEBHOOK_URL = ''
    await notifyNewReview({ rating: 5, message: 'x', code: 'A', provider: null, total: 1 })
    expect(sent).toHaveLength(0)
  })
})
