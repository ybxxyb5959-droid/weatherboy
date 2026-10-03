import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { env } from '../../src/config/env.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

beforeAll(() => {
  installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
  mockKakaoFetch()
  Object.assign(env, { AI_ENABLED: false }) // 이 파일은 '꺼진 상태'를 확인한다
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

describe('AI 경로', () => {
  const a = agent()

  it('로그인 없이는 쓸 수 없다', async () => {
    await agent().get('/api/ai/status').expect(401)
    await agent().post('/api/ai/parse-event').send({ text: '다음주 금요일 제주 여행' }).expect(401)
  })

  it('AI 가 꺼져 있으면 status 가 false, 호출하면 503', async () => {
    await a.post('/api/auth/guest').expect(201)
    expect((await a.get('/api/ai/status')).body).toEqual({ enabled: false })
    const r = await a.post('/api/ai/parse-event').send({ text: '다음주 금요일 제주 여행' })
    expect(r.status).toBe(503)
    expect(r.body.code).toBe('AI_DISABLED')
  })

  it('사진 경로는 100KB 가 넘는 본문도 받는다 (잘못된 형식이면 413 이 아니라 400)', async () => {
    const big = 'data:image/gif;base64,' + 'A'.repeat(300_000)
    expect((await a.post('/api/ai/clothing-from-photo').send({ image: big })).status).toBe(400)
  })

  it('다른 경로는 여전히 100KB 제한', async () => {
    const r = await a.post('/api/events').send({ title: 'x'.repeat(200_000), startDate: '2026-12-01', kind: '기타' })
    expect(r.status).toBe(413)
  })

  it('입력 검증: 너무 짧은 문장은 400', async () => {
    expect((await a.post('/api/ai/parse-event').send({ text: '' })).status).toBe(400)
  })

  it('코디 상담: AI 가 꺼져도 되묻기(선택지) -> 분위기 선택 -> 코디가 나온다', async () => {
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'sample' }).expect(200) // 위치가 있어야 예보로 코디를 고른다
    const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const ev = (await a.post('/api/events').send({ title: '면접', startDate: tomorrow, kind: '기타' })).body as { id: string }
    // 캐릭터가 먼저 거는 말: AI 없이 바로 제목에 맞는 인사와 선택지
    const start = await a.get(`/api/ai/event-stylist/${ev.id}/start`)
    expect(start.status).toBe(200)
    expect(start.body.reply).toContain('면접')
    expect(start.body.options.map((o: { style: string }) => o.style)).toEqual(['FORMAL', 'SMART'])
    const ask = await a.post('/api/ai/event-stylist').send({ eventId: ev.id, text: '뭐 입어야할지 모르겠어 ㅠㅠ' })
    expect(ask.status).toBe(200)
    expect(ask.body.outfit).toBeNull()
    expect(ask.body.options.map((o: { style: string }) => o.style)).toEqual(['FORMAL', 'SMART'])
    const pick = await a.post('/api/ai/event-stylist').send({ eventId: ev.id, style: 'SMART' })
    expect(pick.status).toBe(200)
    expect(pick.body.outfit.items.length).toBeGreaterThanOrEqual(2)
    // 고른 분위기는 일정에 저장돼서, 일정의 '이렇게 입어요'가 같은 코디를 보여준다
    const outfit = await a.get(`/api/events/${ev.id}/outfit`)
    expect(outfit.body).toMatchObject({ style: 'SMART' })
    expect(outfit.body.styleLabel).toContain('비즈니스')
    expect(outfit.body.recommendation.items.map((i: { clothingId: string }) => i.clothingId)).toEqual(pick.body.outfit.items.map((i: { clothingId: string }) => i.clothingId))
    // 말로 분위기를 바로 말하면 되묻지 않고 코디를 준다
    const direct = await a.post('/api/ai/event-stylist').send({ eventId: ev.id, text: '정장으로 입을래' })
    expect(direct.body.outfit.styleLabel).toContain('정장')
  })

  it('코디 상담: 분위기를 해제하면 날씨만 보고 고르던 상태로 돌아간다', async () => {
    const ev = (await prisma.event.findFirstOrThrow({ where: { title: '면접' }, orderBy: { createdAt: 'desc' } }))
    expect(ev.outfitStyle).not.toBeNull()
    expect((await a.delete(`/api/ai/event-stylist/${ev.id}`)).status).toBe(204)
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).outfitStyle).toBeNull()
    const o = await a.get(`/api/events/${ev.id}/outfit`)
    expect(o.body.style).toBeNull()
    expect(o.body.styleLabel).toBeNull()
  })

  it('코디 상담: 직접 분위기를 바꿔도 푸시 기준(lastDecisionKey)을 새 코디에 맞춰 "바뀌었어요" 알림이 가지 않는다', async () => {
    const ev = (await prisma.event.findFirstOrThrow({ where: { title: '면접' }, orderBy: { createdAt: 'desc' } }))
    await prisma.event.update({ where: { id: ev.id }, data: { lastDecisionKey: 'old-key' } })
    expect((await a.post('/api/ai/event-stylist').send({ eventId: ev.id, style: 'FORMAL' })).status).toBe(200)
    const after = await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })
    expect(after.outfitStyle).toBe('FORMAL')
    expect(after.lastDecisionKey).not.toBe('old-key')
    expect(after.lastDecisionKey).not.toBeNull()
  })

  it('코디 상담: 야외 일정(등산)이면 편한 옷 선택지를 먼저 준다', async () => {
    const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const ev = (await a.post('/api/events').send({ title: '북한산', startDate: tomorrow, kind: '등산' })).body as { id: string }
    const start = await a.get(`/api/ai/event-stylist/${ev.id}/start`)
    expect(start.body.options.map((o: { style: string }) => o.style)).toEqual(['COMFORT', 'CASUAL'])
    // 별 조건이 없는 야외 일정은 날씨 엔진이 이미 반영하므로 도우미를 보여주지 않는다
    expect(start.body.applicable).toBe(false)
  })

  it('코디 상담: 도우미를 보여줄 일정은 기타 일정과, 제목에 격식 있는 자리가 든 야외 일정', async () => {
    const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const mk = async (title: string, kind: string) => ((await a.post('/api/events').send({ title, startDate: tomorrow, kind })).body as { id: string }).id
    const applicable = async (id: string) => (await a.get(`/api/ai/event-stylist/${id}/start`)).body.applicable
    expect(await applicable(await mk('그냥 약속', '기타'))).toBe(true)
    expect(await applicable(await mk('제주 여행', '여행'))).toBe(false)
    expect(await applicable(await mk('제주 결혼식 하객', '여행'))).toBe(true)
  })

  it('일정 코디: 옷장에 격식 있는 옷이 부족하면 무엇이 있으면 좋은지 알려준다', async () => {
    const ev = (await prisma.event.findFirstOrThrow({ where: { title: '면접' }, orderBy: { createdAt: 'desc' } }))
    const r = await a.post('/api/ai/event-stylist').send({ eventId: ev.id, style: 'FORMAL' })
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body.outfit.tabooReasons)).toBe(true)
    if (!r.body.outfit.styleMatched) expect(r.body.reply).toContain('가장 가까운 옷')
    const o = await a.get(`/api/events/${ev.id}/outfit`)
    expect(Array.isArray(o.body.situationNotes)).toBe(true)
  })

  it('코디 상담: 남의 일정/잘못된 입력은 거절', async () => {
    expect((await a.get('/api/ai/event-stylist/00000000-0000-4000-8000-000000000000/start')).status).toBe(404)
    expect((await a.post('/api/ai/event-stylist').send({ eventId: '00000000-0000-4000-8000-000000000000', style: 'SMART' })).status).toBe(404)
    expect((await a.post('/api/ai/event-stylist').send({ eventId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400)
  })
})
