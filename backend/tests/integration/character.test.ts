import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  installFakeProviders()
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('내 캐릭터 API', () => {
  const a = agent()

  it('로그인 없이는 쓸 수 없다', async () => {
    await agent().get('/api/character').expect(401)
    await agent().put('/api/character').send({ config: {} }).expect(401)
  })

  it('예시 옷은 분석에 넣지 않는다: 옷이 부족하면 칭호가 없고 몇 벌 더 필요한지 알려준다', async () => {
    await a.post('/api/auth/guest').expect(201)
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'sample' }).expect(200)
    const r = (await a.get('/api/character').expect(200)).body
    expect(r.analysis).toMatchObject({ count: 0, ready: false, need: 5, title: null })
    expect(r.config).toEqual({})
    expect(r.catalog.map((s: { slot: string }) => s.slot)).toEqual(['hat', 'hairpin', 'glasses', 'neck', 'face', 'extra'])
  })

  it('옷장을 채우기 전에는 캐릭터가 잠겨 있다: 꾸미기 저장은 409', async () => {
    const r = (await a.get('/api/character').expect(200)).body
    expect(r).toMatchObject({ unlocked: false, minClothes: 5 })
    const put = await a.put('/api/character').send({ config: { hat: 'beanie' } })
    expect(put.status).toBe(409)
    expect(put.body.code).toBe('CHARACTER_LOCKED')
    expect((await a.get('/api/character')).body.config).toEqual({}) // 저장되지 않았다
  })

  it('검정 옷을 5벌 담으면 "어둠의 아이"가 되고 색 비중이 나온다', async () => {
    for (const t of ['후드티', '바지', '반팔', '긴팔', '맨투맨']) await a.post('/api/clothes').send({ type: t, color: '검정' }).expect(201)
    const r = (await a.get('/api/character').expect(200)).body
    expect(r.analysis.ready).toBe(true)
    expect(r.unlocked).toBe(true) // 옷장을 채우면 캐릭터가 열린다
    expect(r.analysis.title).toMatchObject({ key: 'DARK_CHILD', name: '어둠의 아이' })
    expect(r.analysis.colors[0]).toMatchObject({ name: '검정', count: 5, share: 1 })
    expect(r.titles).toHaveLength(17)
  })

  it('꾸미기를 저장하고 다시 읽을 수 있다. 값을 null 로 보내면 벗는다', async () => {
    const put = await a.put('/api/character').send({ config: { hat: 'beanie', glasses: 'round', hairpin: null } })
    expect(put.status).toBe(200)
    expect(put.body.config).toEqual({ hat: 'beanie', glasses: 'round' })
    expect((await a.get('/api/character')).body.config).toEqual({ hat: 'beanie', glasses: 'round' })
    const off = await a.put('/api/character').send({ config: { hat: null, glasses: 'round' } })
    expect(off.body.config).toEqual({ glasses: 'round' })
  })

  it('없는 아이템이나 슬롯은 거부한다', async () => {
    expect((await a.put('/api/character').send({ config: { hat: 'rocket' } })).status).toBe(400)
    expect((await a.put('/api/character').send({ config: { shoes: 'beanie' } })).status).toBe(400)
    expect((await a.put('/api/character').send({})).status).toBe(400)
    expect((await a.get('/api/character')).body.config).toEqual({ glasses: 'round' }) // 거부된 요청은 저장을 바꾸지 않는다
  })

  it('다른 사용자의 캐릭터와 섞이지 않는다', async () => {
    const b = agent()
    await b.post('/api/auth/guest').expect(201)
    const r = (await b.get('/api/character')).body
    expect(r.config).toEqual({})
    expect(r.analysis.count).toBe(0)
  })
})
