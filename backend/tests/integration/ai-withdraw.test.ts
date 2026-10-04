import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/db.js'
import { recordAiCall } from '../../src/services/ai/aiLog.js'
import { runWithAiScope } from '../../src/services/ai/aiScope.js'
import { agent, pool } from './helpers.js'

afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

const row = (userId: string, kind: string) => ({ model: 'test-model', status: 'SUCCESS' as const, userId, kind })

describe('탈퇴와 AI 호출 기록', () => {
  it('탈퇴하면 그 사용자의 기록에서 userId 가 지워지고(기록은 남음), 다른 사용자 기록은 그대로다', async () => {
    const a = agent()
    const b = agent()
    const ua = (await a.post('/api/auth/guest').expect(201)).body
    const ub = (await b.post('/api/auth/guest').expect(201)).body
    await prisma.aiCallLog.createMany({ data: [row(ua.id, 'photo'), row(ua.id, 'explain'), row(ub.id, 'text')] })
    const beforeAll = await prisma.aiCallLog.count()

    expect((await a.delete('/api/me')).status).toBe(204)

    expect(await prisma.aiCallLog.count({ where: { userId: ua.id } })).toBe(0)
    expect(await prisma.aiCallLog.count()).toBe(beforeAll) // 호출 기록 자체는 서버 전체 집계를 위해 남는다
    expect(await prisma.aiCallLog.count({ where: { userId: ub.id } })).toBe(1)
  })

  it('탈퇴 중에 끝난 AI 호출은 삭제된 사용자 ID 를 다시 남기지 않는다', async () => {
    const a = agent()
    const ua = (await a.post('/api/auth/guest').expect(201)).body
    const marker = `late-${Date.now()}`
    await a.delete('/api/me').expect(204) // 사용자는 이미 없다. AI 호출이 이제서야 끝났다고 가정
    await runWithAiScope({ userId: ua.id, kind: 'explain' }, () => recordAiCall({ model: marker, status: 'SUCCESS', fallback: false, durationMs: 5 }))

    const logs = await prisma.aiCallLog.findMany({ where: { model: marker } })
    expect(logs).toHaveLength(1) // 호출 한 건으로는 남고
    expect(logs[0]!.userId).toBeNull() // 누구 것인지는 남지 않는다
    expect(logs[0]!.kind).toBe('explain')
    expect(await prisma.aiCallLog.count({ where: { userId: ua.id } })).toBe(0)
  })

  it('사용자가 살아 있으면 userId 와 종류가 그대로 남는다', async () => {
    const a = agent()
    const ua = (await a.post('/api/auth/guest').expect(201)).body
    const marker = `live-${Date.now()}`
    await runWithAiScope({ userId: ua.id, kind: 'photo' }, () => recordAiCall({ model: marker, status: 'FAILED', fallback: false, message: '실패' }))
    const logs = await prisma.aiCallLog.findMany({ where: { model: marker } })
    expect(logs[0]).toMatchObject({ userId: ua.id, kind: 'photo' })
    await a.delete('/api/me').expect(204)
  })

  it('탈퇴 도중 들어온 호출 기록과 삭제가 동시에 일어나도 삭제된 사용자 ID 가 남지 않는다', async () => {
    for (let i = 0; i < 5; i++) {
      const a = agent()
      const u = (await a.post('/api/auth/guest').expect(201)).body
      const marker = `race-${Date.now()}-${i}`
      await Promise.all([
        a.delete('/api/me').expect(204),
        ...Array.from({ length: 3 }, () => runWithAiScope({ userId: u.id, kind: 'explain' }, () => recordAiCall({ model: marker, status: 'SUCCESS', fallback: false }))),
      ])
      expect(await prisma.aiCallLog.count({ where: { userId: u.id } })).toBe(0)
      expect(await prisma.aiCallLog.count({ where: { model: marker } })).toBe(3)
    }
  })
})
