import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAiLimiter, limitMessage } from '../../src/api/middleware/aiLimits.js'

// 로그인 대신 헤더로 사용자를 흉내 내는 작은 앱: 사진 한도 2회, 말 한도 2회 (한도 인스턴스는 앱마다 하나씩)
function shared() {
  const photo = createAiLimiter('photo', { limit: 2 })
  const text = createAiLimiter('text', { limit: 2 })
  const a = express()
  a.use((req, _res, next) => {
    ;(req as unknown as { userId: string }).userId = String(req.headers['x-user'] ?? 'u1')
    next()
  })
  a.post('/photo', photo, (_req, res) => res.json({ ok: true }))
  a.post('/text', text, (_req, res) => res.json({ ok: true }))
  return a
}

describe('AI 한도: 사진 인식과 말 입력은 따로 센다', () => {
  it('사진 한도를 다 써도 말 입력은 막히지 않는다', async () => {
    const a = shared()
    expect((await request(a).post('/photo')).status).toBe(200)
    expect((await request(a).post('/photo')).status).toBe(200)
    const blocked = await request(a).post('/photo')
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('PHOTO_RATE_LIMITED')
    expect(blocked.body.message).toContain('사진 인식')
    expect(blocked.body.message).toContain('직접')
    // 같은 사용자의 말 입력은 아직 그대로 쓸 수 있다
    expect((await request(a).post('/text')).status).toBe(200)
  })
  it('말 입력 한도를 다 써도 사진 인식은 막히지 않는다', async () => {
    const a = shared()
    await request(a).post('/text')
    await request(a).post('/text')
    const blocked = await request(a).post('/text')
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('AI_RATE_LIMITED')
    expect((await request(a).post('/photo')).status).toBe(200)
  })
  it('사용자마다 따로 센다', async () => {
    const a = shared()
    await request(a).post('/photo').set('x-user', 'u1')
    await request(a).post('/photo').set('x-user', 'u1')
    expect((await request(a).post('/photo').set('x-user', 'u1')).status).toBe(429)
    expect((await request(a).post('/photo').set('x-user', 'u2')).status).toBe(200)
  })
})

describe('한도 안내 문장', () => {
  it('언제 풀리는지와 그동안 할 수 있는 일을 알려준다', () => {
    expect(limitMessage('photo', 12 * 60_000)).toBe('사진 인식을 한 시간에 쓸 수 있는 만큼 다 썼어요. 12분쯤 뒤에 다시 쓸 수 있어요. 지금은 옷을 직접 골라서 넣을 수 있어요.')
    expect(limitMessage('photo', 30_000)).toContain('1분쯤 뒤에')
    expect(limitMessage('text', null)).toContain('잠시 뒤에')
    expect(limitMessage('text', 5 * 60_000)).toContain('버튼으로 직접')
  })
})
