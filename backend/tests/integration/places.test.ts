import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { suggestRegions } from '../../src/data/regions.js'
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

describe('지역 자동완성 (내장 목록)', () => {
  const names = (q: string) => suggestRegions(q).map((r) => r.name)
  it("'서' 를 치면 서울이 맨 위", () => {
    const r = names('서')
    expect(r[0]).toBe('서울')
    expect(r).toContain('서울 서초구')
  })
  it('시/도 전체 이름과 별칭으로도 찾는다', () => {
    expect(names('서울특')[0]).toBe('서울')
    expect(names('제주도')[0]).toBe('제주')
    expect(names('경기도')[0]).toBe('경기')
  })
  it('구/시 이름으로 바로 찾는다', () => {
    expect(names('마포')[0]).toBe('서울 마포구')
    expect(names('수원')[0]).toBe('경기 수원시')
    expect(names('해운')[0]).toBe('부산 해운대구')
    expect(names('서귀')[0]).toBe('제주 서귀포시')
  })
  it("'서울 마' 처럼 띄어 써도 찾는다", () => expect(names('서울 마')[0]).toBe('서울 마포구'))
  it('결과는 최대 8개, 빈 입력/없는 지역은 빈 배열', () => {
    expect(names('서').length).toBeLessThanOrEqual(8)
    expect(names('')).toEqual([])
    expect(names('zzzz')).toEqual([])
  })
})

describe('즐겨찾기 + 다른 지역 날씨', () => {
  const a = agent()
  let favId = ''

  it('로그인 없이는 접근 불가', async () => {
    expect((await agent().get('/api/favorites')).status).toBe(401)
    expect((await agent().get('/api/places/suggest?q=서')).status).toBe(401)
  })

  it('자동완성 API', async () => {
    await a.post('/api/auth/guest')
    await a.post('/api/onboarding/complete').send({ location: '서울 마포구', closetMode: 'sample' })
    const r = await a.get('/api/places/suggest').query({ q: '서' })
    expect(r.status).toBe(200)
    expect(r.body[0]).toEqual({ name: '서울', sido: '서울', district: null })
  })

  it('즐겨찾기 담기/조회/중복/삭제', async () => {
    const created = await a.post('/api/favorites').send({ name: '부산 해운대구' })
    expect(created.status).toBe(201)
    favId = created.body.id
    expect(created.body).toMatchObject({ name: '부산 해운대구' })
    const again = await a.post('/api/favorites').send({ name: '부산 해운대구' })
    expect(again.status).toBe(200)
    expect(again.body.id).toBe(favId)
    expect((await a.get('/api/favorites')).body).toHaveLength(1)
  })

  it('즐겨찾기로 그 지역 날씨와 추천을 본다 (추천은 저장하지 않아 id=null)', async () => {
    const w = await a.get('/api/weather/today').query({ favoriteId: favId })
    expect(w.status).toBe(200)
    expect(w.body.location).toBe('부산 해운대구')
    const r = await a.get('/api/recommendations/today').query({ favoriteId: favId })
    expect(r.status).toBe(200)
    expect(r.body.id).toBeNull()
    expect(r.body.items.length).toBeGreaterThanOrEqual(2)
    // 기본 위치(저장되는 추천)는 그대로 id 가 있다
    expect((await a.get('/api/recommendations/today')).body.id).toEqual(expect.any(String))
  })

  it('저장하지 않은 지역도 이름으로 바로 조회', async () => {
    const w = await a.get('/api/weather/today').query({ place: '제주 서귀포시' })
    expect(w.status).toBe(200)
    expect(w.body.location).toBe('제주 서귀포시')
  })

  it('잘못된 favoriteId 는 400, 없는 id 는 404', async () => {
    expect((await a.get('/api/weather/today').query({ favoriteId: 'abc' })).status).toBe(400)
    expect((await a.get('/api/weather/today').query({ favoriteId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
  })

  it('다른 사용자의 즐겨찾기는 보거나 지우거나 날씨 조회에 쓸 수 없다', async () => {
    const b = agent()
    await b.post('/api/auth/guest')
    await b.post('/api/onboarding/complete').send({ location: '서울 마포구', closetMode: 'sample' })
    expect((await b.get('/api/favorites')).body).toEqual([])
    expect((await b.delete(`/api/favorites/${favId}`)).status).toBe(404)
    expect((await b.get('/api/weather/today').query({ favoriteId: favId })).status).toBe(404)
    expect((await a.get('/api/favorites')).body).toHaveLength(1)
  })

  it('삭제', async () => {
    expect((await a.delete(`/api/favorites/${favId}`)).status).toBe(204)
    expect((await a.get('/api/favorites')).body).toEqual([])
  })

  it('즐겨찾기는 10곳까지', async () => {
    const c = agent()
    await c.post('/api/auth/guest')
    for (let i = 0; i < 10; i++) expect((await c.post('/api/favorites').send({ name: `테스트지역${i}` })).status).toBe(201)
    const over = await c.post('/api/favorites').send({ name: '테스트지역넘침' })
    expect(over.status).toBe(409)
    expect(over.body.code).toBe('FAVORITES_LIMIT')
  })
})

describe('현재 위치 -> 지역 (GET /api/places/reverse)', () => {
  it('로그인 필요', async () => expect((await agent().get('/api/places/reverse?lat=37.5&lng=127')).status).toBe(401))

  it('좌표 범위가 한국 밖이면 400', async () => {
    const a = agent()
    await a.post('/api/auth/guest')
    expect((await a.get('/api/places/reverse?lat=10&lng=10')).status).toBe(400)
    expect((await a.get('/api/places/reverse')).status).toBe(400)
  })
})
