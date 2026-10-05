import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('옷 여러 벌 한 번에 담기 (POST /api/clothes/bulk)', () => {
  const a = agent()

  it('한 번의 요청으로 여러 벌을 담고, 담은 순서대로 돌려준다', async () => {
    await a.post('/api/auth/guest').expect(201)
    const r = await a
      .post('/api/clothes/bulk')
      .send({ items: [{ type: '반팔', color: '흰색' }, { type: '바지', color: '검정', pattern: '체크' }, { type: '자켓', color: '네이비' }] })
      .expect(201)
    expect(r.body.map((c: { type: string }) => c.type)).toEqual(['반팔', '바지', '자켓'])
    expect(r.body[1].pattern).toBe('체크')
    const list = (await a.get('/api/clothes').expect(200)).body as unknown[]
    expect(list).toHaveLength(3)
  })

  it('하나라도 잘못되면 아무것도 담기지 않는다', async () => {
    const before = ((await a.get('/api/clothes').expect(200)).body as unknown[]).length
    await a.post('/api/clothes/bulk').send({ items: [{ type: '반팔', color: '흰색' }, { type: '없는옷', color: '흰색' }] }).expect(400)
    expect(((await a.get('/api/clothes').expect(200)).body as unknown[]).length).toBe(before)
  })

  it('빈 목록이나 너무 많은 목록은 거절한다', async () => {
    await a.post('/api/clothes/bulk').send({ items: [] }).expect(400)
    await a.post('/api/clothes/bulk').send({ items: Array.from({ length: 41 }, () => ({ type: '반팔', color: '흰색' })) }).expect(400)
  })

  it('로그인하지 않으면 401', async () => {
    await agent().post('/api/clothes/bulk').send({ items: [{ type: '반팔', color: '흰색' }] }).expect(401)
  })
})
