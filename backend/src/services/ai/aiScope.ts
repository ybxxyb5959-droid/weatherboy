// 이 AI 호출을 누가(사용자) 어떤 종류(사진/말)로 불렀는지를 요청 처리 내내 들고 다닌다.
// 호출 기록(aiCallLog)이 gemini.ts 안에서 쓰이는데, 사용자 정보를 함수마다 넘기지 않아도 되게 AsyncLocalStorage 에 둔다.
import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestHandler } from 'express'
import type { AuthedRequest } from '../../api/middleware/common.js'

export type AiKind = 'photo' | 'text'
interface Scope {
  userId: string
  kind: AiKind
}
const store = new AsyncLocalStorage<Scope>()

export const currentAiScope = (): Scope | undefined => store.getStore()

/** 이 라우트에서 일어나는 AI 호출을 사용자와 종류에 묶는다. requireAuth 뒤에 둔다. */
export const aiScope =
  (kind: AiKind): RequestHandler =>
  (req, _res, next) => {
    const userId = (req as AuthedRequest).userId
    if (!userId) return next()
    store.run({ userId, kind }, next)
  }
