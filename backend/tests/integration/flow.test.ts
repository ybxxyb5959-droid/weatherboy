import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { eventForecastJob } from '../../src/jobs/eventForecastJob.js'
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

const ymd = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)

describe('Guest 전체 흐름', () => {
  const a = agent()
  let recId = ''
  let eventId = ''

  it('Guest 시작 -> /api/me (onboardingDone=false)', async () => {
    await a.post('/api/auth/guest').expect(201)
    expect((await a.get('/api/me')).body.onboardingDone).toBe(false)
  })

  it('Onboarding(sample) -> Settings 확인', async () => {
    const r = await a.post('/api/onboarding/complete').send({ sensitivity: '추위 많이 탐', location: '서울 마포구', notifyEvent: true, notifyChange: false, closetMode: 'sample' })
    expect(r.status).toBe(200)
    expect(r.body.onboardingDone).toBe(true)
    const s = (await a.get('/api/settings')).body
    expect(s).toMatchObject({ sensitivity: '추위 많이 탐', location: '서울 마포구', notifyEvent: true, notifyChange: false, locationResolved: true })
    expect((await a.get('/api/me')).body.onboardingDone).toBe(true)
  })

  it('Onboarding 재호출해도 예시 옷이 중복 생성되지 않는다', async () => {
    await a.post('/api/onboarding/complete').send({ closetMode: 'sample' }).expect(200)
    expect((await a.get('/api/clothes')).body).toHaveLength(10)
  })

  it('Clothes: 10벌 + 추가/수정/삭제(soft)', async () => {
    const list = (await a.get('/api/clothes')).body
    expect(list).toHaveLength(10)
    expect(list[0]).toEqual({ id: expect.any(String), type: '반팔', thickness: '얇음', color: '흰색', pattern: '무지', windproof: false, waterproof: false, isSample: true })
    const added = await a.post('/api/clothes').send({ type: '코트', thickness: '두꺼움', color: '검정', windproof: true })
    expect(added.status).toBe(201)
    expect(added.body.type).toBe('코트')
    const patched = await a.patch(`/api/clothes/${added.body.id}`).send({ color: '회색' })
    expect(patched.body.color).toBe('회색')
    expect((await a.delete(`/api/clothes/${added.body.id}`)).status).toBe(204)

    // 두께/방풍/방수를 보내지 않으면 옷 종류로 정한다 (패딩: 방풍, 바람막이: 방풍+방수, 반팔: 둘 다 없음)
    const padding = await a.post('/api/clothes').send({ type: '패딩', color: '검정' })
    expect(padding.body).toMatchObject({ type: '패딩', thickness: '보통', windproof: true, waterproof: false, pattern: '무지' })
    const wb = await a.post('/api/clothes').send({ type: '바람막이', color: '초록' })
    expect(wb.body).toMatchObject({ windproof: true, waterproof: true })
    const tee = await a.post('/api/clothes').send({ type: '반팔', color: '흰색' })
    expect(tee.body).toMatchObject({ windproof: false, waterproof: false })
    // 종류를 바꾸면 방풍/방수도 새 종류에 맞게, 직접 보낸 값은 그대로
    expect((await a.patch(`/api/clothes/${tee.body.id}`).send({ type: '패딩' })).body).toMatchObject({ type: '패딩', windproof: true })
    expect((await a.patch(`/api/clothes/${tee.body.id}`).send({ type: '바람막이', waterproof: false })).body).toMatchObject({ windproof: true, waterproof: false })
    for (const x of [padding, wb, tee]) expect((await a.delete(`/api/clothes/${x.body.id}`)).status).toBe(204)

    // 색 16가지와 무늬: 네이비 체크 셔츠를 등록하고 무늬를 고쳐본다
    const plaid = await a.post('/api/clothes').send({ type: '긴팔', thickness: '보통', color: '네이비', pattern: '체크' })
    expect(plaid.status).toBe(201)
    expect(plaid.body).toMatchObject({ color: '네이비', pattern: '체크' })
    expect((await a.patch(`/api/clothes/${plaid.body.id}`).send({ pattern: '줄무늬' })).body).toMatchObject({ color: '네이비', pattern: '줄무늬' })
    expect((await a.patch(`/api/clothes/${plaid.body.id}`).send({ color: '카키' })).body).toMatchObject({ color: '카키', pattern: '줄무늬' }) // 무늬는 유지
    expect((await a.post('/api/clothes').send({ type: '긴팔', thickness: '보통', color: '네이비', pattern: '호피' })).status).toBe(400)
    expect((await a.post('/api/clothes').send({ type: '긴팔', thickness: '보통', color: '무지개' })).status).toBe(400)
    expect((await a.delete(`/api/clothes/${plaid.body.id}`)).status).toBe(204)
    expect((await a.get('/api/clothes')).body).toHaveLength(10)
    expect((await a.post('/api/clothes').send({ type: '없는옷', thickness: '보통', color: '검정' })).status).toBe(400)
  })

  it('Weather today (Provider 는 Fake)', async () => {
    const r = await a.get('/api/weather/today')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ location: '서울 마포구', temp: 12, rainChance: 20, condition: 'cloudy' })
    expect(r.body.wind).toEqual({ speed: 4.2, label: '약간 강함' })
    expect(r.body.dust).toMatchObject({ pm10: 35, pm25: 18, grade: '보통' })
  })

  it('Recommendation today: 예시 옷은 확인하기 전이라 일반 추천, 미세먼지 보통이면 마스크 false', async () => {
    // 예시 옷을 '내 옷이에요'로 확인하면 보유 옷에서 고른다
    for (const c of (await a.get('/api/clothes')).body as { id: string }[]) await a.patch(`/api/clothes/${c.id}`).send({ confirmed: true }).expect(200)
    const r = await a.get('/api/recommendations/today')
    expect(r.status).toBe(200)
    recId = r.body.id
    expect(r.body.needMask).toBe(false)
    expect(r.body.needUmbrella).toBe(false)
    expect(r.body.items.length).toBeGreaterThanOrEqual(2)
    expect(r.body.items.every((i: { owned: boolean }) => i.owned)).toBe(true)
    expect(r.body.reasons.join(' ')).toContain('추위를 많이 타는')
    // 같은 판단이면 같은 id (피드백이 안정적으로 붙는다)
    expect((await a.get('/api/recommendations/today')).body.id).toBe(recId)
  })

  it('Feedback 저장, 중복은 409, feedbackOffset 반영', async () => {
    expect((await a.post(`/api/recommendations/${recId}/feedback`).send({ rating: '추웠어요' })).status).toBe(201)
    expect((await a.post(`/api/recommendations/${recId}/feedback`).send({ rating: '더웠어요' })).status).toBe(409)
    const u = await prisma.user.findFirstOrThrow({ where: { identities: { some: { provider: 'GUEST' } }, feedbackOffset: { not: 0 } }, orderBy: { updatedAt: 'desc' } })
    // 후기는 그 추천의 기온대 한 곳에만 쌓이고, feedbackOffset 은 세 기온대의 평균이다
    expect(Object.values(u.feedbackBandsJson as Record<string, number>).sort()).toEqual([-0.5, 0, 0])
    expect(u.feedbackOffset).toBe(-0.17)
    expect((await a.post(`/api/recommendations/${recId}/feedback`).send({ rating: '이상한값' })).status).toBe(400)
  })

  it('다른 옷을 입고 남긴 후기는 기록만 하고, 기온대별로 따로 쌓인다', async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { identities: { some: { provider: 'GUEST' } }, feedbackOffset: { not: 0 } }, orderBy: { updatedAt: 'desc' } })
    const before = u.feedbackBandsJson as Record<string, number>
    const mk = (judgedTemp: number, feedbackBand: string) =>
      prisma.recommendation.create({ data: { userId: u.id, targetStartAt: new Date(), targetEndAt: new Date(), resultJson: { judgedTemp, feedbackBand }, reasonCodes: [], decisionKey: `band-${feedbackBand}-${Math.random()}` } })
    const skipped = await mk(5, 'low')
    expect((await a.post(`/api/recommendations/${skipped.id}/feedback`).send({ rating: '추웠어요', followed: false })).status).toBe(201)
    expect(((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).feedbackBandsJson as Record<string, number>)).toEqual(before)
    expect((await prisma.feedback.findFirstOrThrow({ where: { recommendationId: skipped.id } })).followed).toBe(false)

    const hot = await mk(25, 'high')
    expect((await a.post(`/api/recommendations/${hot.id}/feedback`).send({ rating: '더웠어요' })).status).toBe(201)
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).feedbackBandsJson as Record<string, number>
    expect(after.high).toBe((before.high ?? 0) + 0.5)
    expect(after.low).toBe(before.low)
    expect(after.mid).toBe(before.mid)

    // 설정에서 보이고, 되돌리면 모두 0
    expect(((await a.get('/api/settings')).body.feel as Record<string, number>).high).toBe(after.high)
    const reset = await a.put('/api/settings').send({ resetFeel: true })
    expect(reset.body.feel).toEqual({ low: 0, mid: 0, high: 0 })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).feedbackOffset).toBe(0)
  })

  it('Event 등록 -> 조회 -> outfit', async () => {
    const tomorrow = ymd(new Date(Date.now() + 86400_000))
    const created = await a.post('/api/events').send({ title: '제주 여행', startDate: tomorrow, startTime: '09:00', endTime: '20:00', place: '서울 마포구', kind: '여행' })
    expect(created.status).toBe(201)
    eventId = created.body.id
    expect(created.body).toMatchObject({ title: '제주 여행', startDate: tomorrow, startTime: '09:00', endTime: '20:00', kind: '여행', status: 'waiting' })
    expect((await a.get('/api/events')).body).toHaveLength(1)
    expect((await a.get(`/api/events/${eventId}`)).body.id).toBe(eventId)

    const o = await a.get(`/api/events/${eventId}/outfit`)
    expect(o.status).toBe(200)
    expect(o.body.status).toBe('ready')
    expect(o.body.forecastStage).toBe('SHORTTERM')
    expect(o.body.recommendation.items.length).toBeGreaterThanOrEqual(2)
    expect((await a.get(`/api/events/${eventId}`)).body.status).toBe('ready')
  })

  it('예보가 없는 먼 일정은 404/500 이 아니라 waiting', async () => {
    const far = ymd(new Date(Date.now() + 60 * 86400_000))
    const e = (await a.post('/api/events').send({ title: '먼 일정', startDate: far, place: '서울 마포구', kind: '기타' })).body
    const o = await a.get(`/api/events/${e.id}/outfit`)
    expect(o.status).toBe(200)
    expect(o.body).toMatchObject({ status: 'waiting', forecastStage: 'WAITING', recommendation: null })
  })

  it('종료 시간이 시작보다 빠르면 400', async () => {
    const r = await a.post('/api/events').send({ title: 'x', startDate: ymd(new Date()), startTime: '20:00', endTime: '10:00', kind: '여행' })
    expect(r.status).toBe(400)
    expect(r.body.code).toBe('VALIDATION_ERROR')
  })

  it('Worker: 최초 생성 Push 1회, 같은 판단이면 재전송 없음, 판단이 바뀌면 변경 Push', async () => {
    const sub = { endpoint: `https://push.example/${Date.now()}`, keys: { p256dh: 'p', auth: 'a' } }
    expect((await a.post('/api/push/subscribe').send(sub)).status).toBe(201)
    const user = await prisma.user.findFirstOrThrow({ where: { events: { some: { id: eventId } } } })
    await prisma.user.update({ where: { id: user.id }, data: { notifyChange: true } })
    const sender = vi.fn(async (_s: { endpoint: string }) => undefined)
    const mine = () => sender.mock.calls.filter((c) => c[0].endpoint === sub.endpoint).length // 다른 테스트가 남긴 일정은 세지 않는다
    const noon = new Date(`${ymd(new Date())}T03:00:00Z`) // 12:00 KST
    await eventForecastJob(noon, sender)
    expect(mine()).toBe(1)
    await eventForecastJob(noon, sender)
    expect(mine()).toBe(1) // 동일 판단 -> 재전송 없음

    // 판단 변경: 비 예보 -> 우산 필요
    installFakeProviders({ temp: 12, pop: 80, airGrade: 2 })
    await prisma.forecastSnapshot.deleteMany({})
    await eventForecastJob(noon, sender)
    expect(mine()).toBe(2)
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    expect(ev.notificationCount).toBe(2)
    expect((await prisma.notifyLog.count({ where: { eventId, status: 'SENT' } }))).toBe(2)
  })

  it('Worker: 야간(23~07 KST)에는 Push 하지 않고 판단을 보류한다', async () => {
    installFakeProviders({ temp: 12, pop: 20, airGrade: 2 })
    await prisma.forecastSnapshot.deleteMany({})
    const e = (await a.post('/api/events').send({ title: '야간 테스트', startDate: ymd(new Date(Date.now() + 86400_000)), place: '서울 마포구', kind: '기타' })).body
    const sender = vi.fn(async () => undefined)
    const night = new Date(`${ymd(new Date())}T15:30:00Z`) // 00:30 KST (다음날)
    await eventForecastJob(night, sender)
    expect(sender).not.toHaveBeenCalled()
    const ev = await prisma.event.findUniqueOrThrow({ where: { id: e.id } })
    expect(ev.lastDecisionKey).toBeNull() // 낮에 재시도할 수 있도록 보류
  })
})

describe('Worker: 위치 미설정 사용자', () => {
  it('온보딩 전 사용자의 일정은 실패가 아니라 건너뛴다', async () => {
    const a = agent()
    await a.post('/api/auth/guest')
    const e = (await a.post('/api/events').send({ title: '위치없음', startDate: ymd(new Date(Date.now() + 86400_000)), kind: '기타' })).body
    await eventForecastJob(new Date(), vi.fn(async () => undefined))
    expect(await prisma.collectLog.count({ where: { job: 'eventForecast', target: e.id, status: 'FAILED' } })).toBe(0)
    expect((await prisma.event.findUniqueOrThrow({ where: { id: e.id } })).lastCheckedAt).not.toBeNull()
  })
})

describe('Authorization: 다른 사용자 데이터 접근 불가', () => {
  it('User A 는 User B 의 옷/일정을 읽거나 바꾸거나 지울 수 없다', async () => {
    const a = agent()
    const b = agent()
    await a.post('/api/auth/guest')
    await b.post('/api/auth/guest')
    const cloth = (await b.post('/api/clothes').send({ type: '패딩', thickness: '두꺼움', color: '검정' })).body
    const ev = (await b.post('/api/events').send({ title: 'B 일정', startDate: ymd(new Date(Date.now() + 86400_000)), kind: '캠핑' })).body

    expect((await a.get('/api/clothes')).body).toEqual([])
    expect((await a.patch(`/api/clothes/${cloth.id}`).send({ color: '흰색' })).status).toBe(404)
    expect((await a.delete(`/api/clothes/${cloth.id}`)).status).toBe(404)
    expect((await a.get('/api/events')).body).toEqual([])
    expect((await a.get(`/api/events/${ev.id}`)).status).toBe(404)
    expect((await a.patch(`/api/events/${ev.id}`).send({ title: 'hack' })).status).toBe(404)
    expect((await a.get(`/api/events/${ev.id}/outfit`)).status).toBe(404)
    expect((await a.delete(`/api/events/${ev.id}`)).status).toBe(404)

    // B 의 데이터는 그대로
    expect((await b.get('/api/clothes')).body).toHaveLength(1)
    expect((await b.get(`/api/events/${ev.id}`)).body.title).toBe('B 일정')
  })

  it('Admin API 는 일반 사용자에게 403', async () => {
    const a = agent()
    await a.post('/api/auth/guest')
    expect((await a.get('/api/admin/ops/summary')).status).toBe(403)
  })
})
