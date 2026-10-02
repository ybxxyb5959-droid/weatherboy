import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

beforeAll(async () => {
  await prisma.forecastSnapshot.deleteMany({}) // 다른 테스트가 남긴 예보 캐시(기온)가 섞이지 않게
  installFakeProviders({ temp: 19, pop: 10, airGrade: 2 }) // 선선한 날: 반팔+바지만으로는 보온이 모자라 겉옷이 필요하다
  mockKakaoFetch()
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

type Item = { clothingId: string | null; type: string; owned: boolean }
type Rec = { items: Item[]; alternatives: Item[][]; needOuter: boolean; insufficientWardrobe: boolean }

describe('옷을 추가하면 홈 추천에 반영된다', () => {
  const a = agent()
  const today = async () => (await a.get('/api/recommendations/today').expect(200)).body as Rec
  const add = async (body: object) => (await a.post('/api/clothes').send(body).expect(201)).body as { id: string }

  it('겉옷이 없으면 부족하다고 알려주고, 가디건을 담으면 그 옷이 추천에 들어간다', async () => {
    await a.post('/api/auth/guest').expect(201)
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty' }).expect(200)
    await add({ type: '반팔', color: '흰색' })
    await add({ type: '바지', color: '검정' })
    const before = await today()
    expect(before.needOuter).toBe(false) // 입을 겉옷이 없다
    expect(before.insufficientWardrobe).toBe(true)

    const cardigan = await add({ type: '가디건', color: '베이지' })
    const after = await today()
    expect(after.insufficientWardrobe).toBe(false)
    expect(after.needOuter).toBe(true)
    expect(after.items.map((i) => i.clothingId)).toContain(cardigan.id)
  })

  it('새로 담은 셔츠·바지가 "다른 조합 보기"에 들어온다', async () => {
    const shirt = await add({ type: '긴팔', color: '하늘색' })
    const pants = await add({ type: '바지', color: '네이비' })
    const r = await today()
    const used = new Set([...r.items, ...r.alternatives.flat()].map((i) => i.clothingId))
    expect(used.has(shirt.id) || used.has(pants.id)).toBe(true)
  })

  it('셔츠를 담으면 셔츠 종류로 저장되고 옷 목록에 보인다', async () => {
    await add({ type: '셔츠', color: '흰색', pattern: '줄무늬' })
    const list = (await a.get('/api/clothes')).body as { type: string; pattern: string }[]
    expect(list.find((c) => c.type === '셔츠')).toMatchObject({ pattern: '줄무늬' })
  })
})
