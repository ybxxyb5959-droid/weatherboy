import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn().mockResolvedValue({})
vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { create: (...a: unknown[]) => create(...a) } } }))

import { env } from '../../src/config/env.js'
import { geminiJson } from '../../src/services/ai/gemini.js'
import { aiScope, currentAiScope } from '../../src/services/ai/aiScope.js'
import { z } from 'zod'

const fakeFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ a: 1 }) }] } }] }) })) as unknown as typeof fetch
const schema = z.object({ a: z.number() })

let saved: { AI_ENABLED: boolean; GEMINI_API_KEY: string; GEMINI_MODEL: string }
beforeEach(() => {
  create.mockClear()
  saved = { AI_ENABLED: env.AI_ENABLED, GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL }
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' })
})
afterEach(() => Object.assign(env, saved))

describe('호출 기록에 사용자와 종류가 남는다', () => {
  it('aiScope 안에서 부른 AI 호출은 userId/kind 와 함께 기록된다(비동기 처리 뒤에도)', async () => {
    const app = express()
    app.use((req, _res, next) => {
      ;(req as unknown as { userId: string }).userId = 'user-1'
      next()
    })
    app.post('/photo', aiScope('photo'), async (_req, res) => {
      await new Promise((r) => setTimeout(r, 5)) // 중간에 await 가 끼어도 컨텍스트가 이어져야 한다
      await geminiJson({ prompt: 'x', schema: {}, validate: schema, fetchImpl: fakeFetch })
      res.json({ scope: currentAiScope() })
    })
    const r = await request(app).post('/photo')
    expect(r.body.scope).toEqual({ userId: 'user-1', kind: 'photo' })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0].data).toMatchObject({ userId: 'user-1', kind: 'photo', status: 'SUCCESS' })
  })
  it('요청 밖에서 부른 호출(예: 백그라운드 설명)은 사용자 없이 기록된다', async () => {
    await geminiJson({ prompt: 'x', schema: {}, validate: schema, fetchImpl: fakeFetch })
    expect(create.mock.calls[0]![0].data.userId).toBeUndefined()
    expect(create.mock.calls[0]![0].data.kind).toBeUndefined()
  })
  it('동시에 들어온 두 사용자의 기록이 섞이지 않는다', async () => {
    const app = express()
    app.use((req, _res, next) => {
      ;(req as unknown as { userId: string }).userId = String(req.headers['x-user'])
      next()
    })
    app.post('/text', aiScope('text'), async (req, res) => {
      await new Promise((r) => setTimeout(r, Math.random() * 20))
      await geminiJson({ prompt: 'x', schema: {}, validate: schema, fetchImpl: fakeFetch })
      res.json({ ok: true, who: (req as unknown as { userId: string }).userId })
    })
    await Promise.all(['a', 'b', 'c', 'd'].map((u) => request(app).post('/text').set('x-user', u)))
    const users = create.mock.calls.map((c) => c[0].data.userId).sort()
    expect(users).toEqual(['a', 'b', 'c', 'd'])
  })
})
