import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { COLD_RETURN_DROP, coldReturnNote, dailyPushJob, isClosetSlot, morningBody, planFor } from '../../src/jobs/dailyPushJob.js'
import { kstStartOfDay } from '../../src/utils/time.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

// 2026-10-05 는 월요일, 2026-10-04 는 일요일 (KST)
const kst = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+09:00`)

describe('알림 시각 계산(planFor)', () => {
  const user = { routineOutAt: '08:30', routineHomeAt: '18:00', routineDays: [1, 2, 3, 4, 5], morningLeadMin: 30 }

  it('아침 알림은 외출 30분 전부터 외출 15분 뒤까지', () => {
    expect(planFor(user, kst('2026-10-05', '07:59')).morning).toBe(false)
    expect(planFor(user, kst('2026-10-05', '08:00')).morning).toBe(true)
    expect(planFor(user, kst('2026-10-05', '08:44')).morning).toBe(true)
    expect(planFor(user, kst('2026-10-05', '08:45')).morning).toBe(false)
  })
  it('패턴에 없는 요일(일요일)에는 아무것도 하지 않는다', () => {
    const p = planFor(user, kst('2026-10-04', '08:10'))
    expect(p.active).toBe(false)
    expect(p.morning || p.outing || p.returnFeedback).toBe(false)
  })
  it('후기 요청은 귀가 30분 뒤부터 3시간', () => {
    expect(planFor(user, kst('2026-10-05', '18:29')).returnFeedback).toBe(false)
    expect(planFor(user, kst('2026-10-05', '18:30')).returnFeedback).toBe(true)
    expect(planFor(user, kst('2026-10-05', '21:29')).returnFeedback).toBe(true)
    expect(planFor(user, kst('2026-10-05', '21:30')).returnFeedback).toBe(false)
  })
  it('외출/귀가를 모르면 08:00 / 18:00 으로 본다', () => {
    const p = planFor({ ...user, routineOutAt: null, routineHomeAt: null }, kst('2026-10-05', '07:40'))
    expect(p.outMin).toBe(8 * 60)
    expect(p.homeMin).toBe(18 * 60)
    expect(p.morning).toBe(true)
  })
  it('옷장 리마인드는 일요일 20시대에만', () => {
    expect(isClosetSlot(kst('2026-10-04', '20:30'))).toBe(true)
    expect(isClosetSlot(kst('2026-10-04', '19:59'))).toBe(false)
    expect(isClosetSlot(kst('2026-10-05', '20:30'))).toBe(false)
  })
})

describe('알림 문구', () => {
  it('아침 알림: 옷 조합 · 한마디 (+ 덧붙이는 말)', () => {
    expect(morningBody(['니트', '파랑 바지'], '좀 쌀쌀해요', [])).toBe('니트 + 파랑 바지 · 좀 쌀쌀해요')
    expect(morningBody(['니트'], '쌀쌀', ['A', 'B'])).toBe('니트 · 쌀쌀\nA\nB')
  })
  it('귀가 추위 문구에 두 기온이 들어간다', () => {
    expect(coldReturnNote(20, 12)).toContain('12°')
    expect(coldReturnNote(20, 12)).toContain('20°')
    expect(COLD_RETURN_DROP).toBeGreaterThan(0)
  })
})

describe('일일 알림 작업 (dailyPushJob)', () => {
  const a = agent()
  let userId = ''
  const sent: { title: string; body: string; url: string }[] = []
  const mine = new Set<string>() // 이번 실행에서 이 테스트가 만든 구독 주소
  const subscribe = async () => {
    const endpoint = `https://push.example/daily-${Date.now()}-${Math.random().toString(36).slice(2)}`
    mine.add(endpoint)
    await a.post('/api/push/subscribe').send({ endpoint, keys: { p256dh: 'p', auth: 'a' } }).expect(201)
  }
  const sender = async (sub: { endpoint: string }, payload: string) => {
    if (mine.has(sub.endpoint)) sent.push(JSON.parse(payload))
  }
  const run = (when: Date) => dailyPushJob(when, sender as never)
  const setUser = (data: object) => prisma.user.update({ where: { id: userId }, data })

  beforeAll(async () => {
    mockKakaoFetch()
    await a.post('/api/auth/guest').expect(201)
    await a.post('/api/onboarding/complete').send({ sensitivity: '보통', location: '서울 마포구', closetMode: 'empty', routine: { outAt: '08:30', homeAt: '18:00', days: [0, 1, 2, 3, 4, 5, 6] } }).expect(200)
    userId = (await a.get('/api/me')).body.id
    await subscribe()
    await a.post('/api/clothes').send({ type: '긴팔', color: '흰색' }).expect(201)
    await a.post('/api/clothes').send({ type: '바지', color: '검정' }).expect(201)
  })
  beforeEach(async () => {
    sent.length = 0
    await prisma.forecastSnapshot.deleteMany({})
    await prisma.notifyLog.deleteMany({ where: { userId } })
    installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
    await setUser({ notifyMorning: true, notifyRain: true, notifyColdReturn: true, notifyDust: false, notifyFeedback: true, notifyCloset: false })
  })

  it('아침: 외출 30분 전부터 오늘의 옷차림을 보내고, 같은 날 다시 돌아도 한 번만', async () => {
    await run(kst('2026-10-05', '08:05'))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ title: '오늘의 옷차림', url: '/home' })
    expect(sent[0]!.body).toContain('+') // 옷 조합
    await run(kst('2026-10-05', '08:20'))
    await run(kst('2026-10-05', '08:35'))
    expect(sent).toHaveLength(1)
    expect(await prisma.notifyLog.count({ where: { userId, kind: 'MORNING', status: 'SENT' } })).toBe(1)
  })

  it('아침 알림 시간이 아니면(한참 전) 보내지 않는다', async () => {
    await run(kst('2026-10-05', '06:00'))
    expect(sent).toHaveLength(0)
  })

  it('아침 알림을 끄면 아침에는 보내지 않는다', async () => {
    await setUser({ notifyMorning: false, notifyColdReturn: false })
    await run(kst('2026-10-05', '08:05'))
    expect(sent).toHaveLength(0)
  })

  it('다음 날은 다시 보낸다', async () => {
    await run(kst('2026-10-05', '08:05'))
    await run(kst('2026-10-06', '08:05'))
    expect(sent.filter((s) => s.title === '오늘의 옷차림')).toHaveLength(2)
  })

  it('미세먼지 나쁨 + 켜짐이면 아침 알림에 마스크 한마디가 붙는다', async () => {
    installFakeProviders({ temp: 12, pop: 20, airGrade: 4 })
    await setUser({ notifyDust: true })
    await run(kst('2026-10-05', '08:05'))
    expect(sent).toHaveLength(1)
    expect(sent[0]!.body).toContain('마스크')
  })

  it('비: 외출 중 2시간 안에 비 예보가 있으면 우산 알림, 하루 한 번', async () => {
    installFakeProviders({ temp: 12, pop: 80, airGrade: 2 })
    await setUser({ notifyMorning: false, notifyColdReturn: false })
    await run(kst('2026-10-05', '10:00'))
    await run(kst('2026-10-05', '10:15'))
    const rain = sent.filter((s) => s.title === '우산 챙기세요')
    expect(rain).toHaveLength(1)
    expect(rain[0]!.body).toContain('비 소식')
  })

  it('비 알림을 끄면 비가 와도 보내지 않는다', async () => {
    installFakeProviders({ temp: 12, pop: 80, airGrade: 2 })
    await setUser({ notifyMorning: false, notifyColdReturn: false, notifyRain: false })
    await run(kst('2026-10-05', '10:00'))
    expect(sent).toHaveLength(0)
  })

  it('후기 요청: 오늘 추천을 봤고 후기를 안 남겼을 때만, 귀가 30분 뒤', async () => {
    const day = kst('2026-10-05', '19:00')
    await run(day) // 오늘 추천 기록이 없다 -> 보내지 않는다
    expect(sent).toHaveLength(0)

    const rec = await prisma.recommendation.create({
      data: { userId, targetStartAt: kstStartOfDay(day), targetEndAt: day, resultJson: {}, reasonCodes: [], decisionKey: 'x', version: 1 },
    })
    await run(day)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ title: '오늘 어땠나요?', url: '/home?fb=now' })

    // 이미 후기를 남겼다면(다음 날 같은 상황 가정 대신 같은 날 새 키로) 보내지 않는다
    sent.length = 0
    await prisma.notifyLog.deleteMany({ where: { userId } })
    await prisma.feedback.create({ data: { userId, recommendationId: rec.id, rating: 'OK' } })
    await run(day)
    expect(sent).toHaveLength(0)
    await prisma.feedback.deleteMany({ where: { userId } })
    await prisma.recommendation.deleteMany({ where: { id: rec.id } })
  })

  it('옷장 리마인드: 켜져 있고 옷이 5벌 미만인 일요일 저녁에만', async () => {
    await setUser({ notifyCloset: true, notifyMorning: false, notifyColdReturn: false, notifyRain: false, notifyFeedback: false })
    await run(kst('2026-10-05', '20:30')) // 월요일
    expect(sent).toHaveLength(0)
    await run(kst('2026-10-04', '20:30')) // 일요일
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ title: '옷장을 채워볼까요?', url: '/wardrobe/add' })
  })

  it('구독이 없는 사용자는 대상이 아니다', async () => {
    await prisma.pushSubscription.deleteMany({ where: { userId } })
    const r = await run(kst('2026-10-05', '08:05'))
    expect(r.sent.MORNING ?? 0).toBe(0)
    await subscribe()
  })

  it('야간(23~07시)에는 보내지 않고, 기록을 남기지 않아 아침에 다시 시도된다', async () => {
    await setUser({ routineOutAt: '07:20' }) // 아침 알림 구간 06:50~07:35 -> 06:50 은 야간(07시 이전)
    await run(kst('2026-10-05', '06:55'))
    expect(sent).toHaveLength(0)
    expect(await prisma.notifyLog.count({ where: { userId, kind: 'MORNING', status: 'SENT' } })).toBe(0)
    await run(kst('2026-10-05', '07:05'))
    expect(sent).toHaveLength(1)
  })
})

describe('설정 API: 알림 종류', () => {
  it('종류별 알림 설정을 저장하고 다시 읽을 수 있다', async () => {
    const a = agent()
    await a.post('/api/auth/guest').expect(201)
    const before = (await a.get('/api/settings')).body
    expect(before).toMatchObject({ notifyMorning: true, notifyRain: true, notifyColdReturn: true, notifyDust: false, notifyFeedback: true, notifyCloset: false, notifyNotice: true, morningLeadMin: 30 })
    const r = await a.put('/api/settings').send({ notifyDust: true, notifyRain: false, morningLeadMin: 45 })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ notifyDust: true, notifyRain: false, morningLeadMin: 45 })
  })
  it('아침 알림 시간은 15/30/45/60분만 받는다', async () => {
    const a = agent()
    await a.post('/api/auth/guest').expect(201)
    expect((await a.put('/api/settings').send({ morningLeadMin: 20 })).status).toBe(400)
  })
})

afterAll(async () => {
  await prisma.forecastSnapshot.deleteMany({}) // 예보 캐시를 남기면 다음 테스트 파일이 이 파일의 기온을 읽는다
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})
