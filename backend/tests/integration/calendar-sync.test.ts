import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/db.js'
import { calendarSyncJob } from '../../src/jobs/calendarSyncJob.js'
import { agent, installFakeProviders, mockKakaoFetch, pool } from './helpers.js'

const ICS_URL = 'https://93.184.216.34/cal-sync-test.ics' // 숫자 주소라 DNS 조회 없이 공개 주소로 통과
let ics = ''
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
const vevent = (uid: string, title: string, start: Date) =>
  ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 3600_000))}`, 'END:VEVENT'].join('\r\n')
const calendar = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n')

let userId = ''
let connId = ''
const base = Date.now() + 2 * 86400_000

beforeAll(async () => {
  installFakeProviders()
  const spy = mockKakaoFetch()
  const kakao = spy.getMockImplementation()!
  spy.mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith('https://93.184.216.34/')) return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar' } })
    return kakao(input, init)
  })
  const a = agent()
  await a.post('/api/auth/guest').expect(201)
  userId = (await a.get('/api/me')).body.id
  connId = (await prisma.calendarConnection.create({ data: { userId, provider: 'GOOGLE', icalUrl: ICS_URL } })).id
})
afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
  await pool.end()
})

const titles = async () => (await prisma.event.findMany({ where: { calendarConnectionId: connId }, orderBy: { startAt: 'asc' } })).map((e) => e.title)

describe('캘린더 자동 동기화 작업 (앱을 열지 않아도)', () => {
  it('처음에는 연결된 캘린더의 일정을 가져온다', async () => {
    ics = calendar(vevent('a@t', '팀 회식', new Date(base)), vevent('b@t', '제주 여행', new Date(base + 86400_000)))
    const r = await calendarSyncJob()
    expect(r.failed).toBe(0)
    expect(await titles()).toEqual(['팀 회식', '제주 여행'])
    expect((await prisma.calendarConnection.findUniqueOrThrow({ where: { id: connId } })).lastSyncedAt).not.toBeNull()
  })

  it('방금 동기화한 연결은 건너뛴다 (30분 안)', async () => {
    ics = calendar(vevent('a@t', '이름 바뀜', new Date(base)))
    await calendarSyncJob()
    expect(await titles()).toEqual(['팀 회식', '제주 여행']) // 아직 안 바뀜
  })

  it('30분이 지나면 바뀐 일정은 수정하고 사라진 일정은 지운다', async () => {
    await prisma.calendarConnection.update({ where: { id: connId }, data: { lastSyncedAt: new Date(Date.now() - 31 * 60_000) } })
    await calendarSyncJob()
    expect(await titles()).toEqual(['이름 바뀜'])
  })

  it('한 캘린더가 실패해도 이유를 기록하고 다음에 다시 시도한다', async () => {
    ics = 'not a calendar'
    await prisma.calendarConnection.update({ where: { id: connId }, data: { lastSyncedAt: new Date(Date.now() - 31 * 60_000) } })
    const r = await calendarSyncJob()
    expect(r.failed).toBeGreaterThanOrEqual(1)
    const c = await prisma.calendarConnection.findUniqueOrThrow({ where: { id: connId } })
    expect(c.lastError).toBeTruthy()
    expect(await titles()).toEqual(['이름 바뀜']) // 실패했다고 기존 일정을 지우지 않는다
  })
})
