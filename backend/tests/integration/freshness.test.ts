import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

type Item = { clothingId: string | null; type: string; color: string }
const clothingIds = (items: Item[]) => items.map((i) => i.clothingId).filter(Boolean)

describe('추천 갱신: 옷장이 바뀌면 오늘 추천에도 반영된다', () => {
  const a = agent()
  let first: { id: string; items: Item[]; version: number }

  it('같은 종류의 옷이 2벌 있을 때 추천이 만들어진다', async () => {
    await a.post('/api/auth/guest').expect(201)
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
    for (const t of ['긴팔', '바지']) {
      for (const color of ['검정', '흰색']) await a.post('/api/clothes').send({ type: t, color }).expect(201)
    }
    const r = await a.get('/api/recommendations/today').expect(200)
    first = r.body
    expect(clothingIds(first.items).length).toBeGreaterThanOrEqual(2)
  })

  it('추천된 옷을 삭제하면 같은 종류의 다른 옷으로 바뀌고 삭제한 옷은 사라진다', async () => {
    const removed = clothingIds(first.items)[0] as string
    await a.delete(`/api/clothes/${removed}`).expect(204)
    const r = await a.get('/api/recommendations/today').expect(200)
    expect(clothingIds(r.body.items)).not.toContain(removed)
    expect(r.body.id).not.toBe(first.id) // 조합이 달라졌으니 새 버전
    expect(r.body.version).toBeGreaterThan(first.version)
  })

  it('옷 색을 바꾸면 추천 화면의 색도 바뀐다', async () => {
    const cur = (await a.get('/api/recommendations/today')).body
    const target = cur.items.find((i: Item) => i.clothingId)
    await a.patch(`/api/clothes/${target.clothingId}`).send({ color: '빨강' }).expect(200)
    const r = (await a.get('/api/recommendations/today').expect(200)).body
    const same = r.items.find((i: Item) => i.clothingId === target.clothingId)
    expect(same?.color ?? '빨강').toBe('빨강')
  })

  it('옷장이 그대로면 같은 추천(id)을 재사용한다 — 피드백이 안정적으로 붙는다', async () => {
    const x = (await a.get('/api/recommendations/today')).body
    const y = (await a.get('/api/recommendations/today')).body
    expect(y.id).toBe(x.id)
    expect(y.version).toBe(x.version)
  })

  it('이전 버전 기록은 보존된다', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { clothes: { some: { id: clothingIds(first.items)[0] as string } } } })
    expect(await prisma.recommendation.count({ where: { userId: user.id, eventId: null } })).toBeGreaterThanOrEqual(2)
  })
})
