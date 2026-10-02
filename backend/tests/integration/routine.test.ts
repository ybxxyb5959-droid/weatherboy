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

describe('하루 패턴 설정', () => {
  const a = agent()

  it('처음에는 시간이 비어 있고 평일이 기본', async () => {
    await a.post('/api/auth/guest').expect(201)
    const s = (await a.get('/api/settings')).body
    expect(s.routine).toEqual({ outAt: null, homeAt: null, days: [1, 2, 3, 4, 5] })
  })

  it('외출 시간/들어오는 시간/요일을 저장한다', async () => {
    const r = await a.put('/api/settings').send({ routine: { outAt: '09:00', homeAt: '18:30', days: [1, 3, 5] } })
    expect(r.status).toBe(200)
    expect(r.body.routine).toEqual({ outAt: '09:00', homeAt: '18:30', days: [1, 3, 5] })
  })

  it('일부만 보내면 나머지는 유지하고, null 로 지울 수 있다', async () => {
    const r = await a.put('/api/settings').send({ routine: { outAt: null } })
    expect(r.body.routine).toEqual({ outAt: null, homeAt: '18:30', days: [1, 3, 5] })
  })

  it('잘못된 시간/요일은 거절한다', async () => {
    await a.put('/api/settings').send({ routine: { outAt: '25:00' } }).expect(400)
    await a.put('/api/settings').send({ routine: { homeAt: '9:00' } }).expect(400)
    await a.put('/api/settings').send({ routine: { days: [7] } }).expect(400)
  })
})

describe('일정 종류', () => {
  const a = agent()
  it("'기타' 일정을 만들 수 있고, 예전 '출근·등교'는 거절한다", async () => {
    await a.post('/api/auth/guest').expect(201)
    const day = new Date(Date.now() + 86400_000 * 3 + 9 * 3600_000).toISOString().slice(0, 10)
    const ok = await a.post('/api/events').send({ title: '친구 약속', startDate: day, kind: '기타' })
    expect(ok.status).toBe(201)
    expect(ok.body.kind).toBe('기타')
    await a.post('/api/events').send({ title: '출근', startDate: day, kind: '출근·등교' }).expect(400)
  })

  it('등산/야외활동을 만들 수 있고, 여행은 며칠짜리(endDate)로 만들 수 있다', async () => {
    const d = (n: number) => new Date(Date.now() + 86400_000 * n + 9 * 3600_000).toISOString().slice(0, 10)
    const hike = await a.post('/api/events').send({ title: '북한산 등산', startDate: d(4), kind: '등산' })
    expect(hike.status).toBe(201)
    expect(hike.body.kind).toBe('등산')
    const picnic = await a.post('/api/events').send({ title: '한강 피크닉', startDate: d(5), kind: '야외활동' })
    expect(picnic.body.kind).toBe('야외활동')
    const trip = await a.post('/api/events').send({ title: '제주 여행', startDate: d(10), endDate: d(12), startTime: '09:00', endTime: '18:00', kind: '여행' })
    expect(trip.status).toBe(201)
    expect(trip.body).toMatchObject({ startDate: d(10), endDate: d(12), kind: '여행' })
  })
})
