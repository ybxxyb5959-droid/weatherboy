// 백엔드 API 호출 도구. 세션은 HttpOnly 쿠키라 항상 credentials: 'include'.
// 개발 중에는 vite proxy 가 /api 를 백엔드(4000)로 넘겨준다.
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface ApiOptions {
  /** 이 시간 안에 응답이 없으면 포기한다(기본: 일반 25초, AI 60초) */
  timeoutMs?: number
  /** 연결 실패·시간 초과·502/503/504 일 때 다시 시도하는 횟수(기본: 조회 2번, 그 밖에는 0번 — 저장·삭제는 두 번 실행되면 안 된다) */
  retries?: number
}

// 무료 서버는 한동안 안 쓰면 잠들었다가 첫 요청에 깨어난다(최대 약 1분). 이때 502/503/504 가 나오거나 응답이 늦을 수 있다.
const RETRY_STATUS = new Set([502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function api<T>(method: string, path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? (path.startsWith('/api/ai/') ? 60_000 : 25_000)
  const retries = opts.retries ?? (method === 'GET' ? 2 : 0)
  let res: Response
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      res = await fetch(path, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch {
      clearTimeout(timer)
      if (attempt < retries) {
        await sleep(800 * (attempt + 1))
        continue
      }
      if (ctrl.signal.aborted) throw new ApiError(0, 'TIMEOUT', '서버 응답이 너무 늦어요. 잠시 후 다시 시도해주세요.')
      throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
    }
    clearTimeout(timer)
    if (RETRY_STATUS.has(res.status) && attempt < retries) {
      await sleep(800 * (attempt + 1))
      continue
    }
    break
  }
  if (res.status === 204) return undefined as T
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* 본문 없음 */
  }
  if (!res.ok) {
    const e = (json ?? {}) as { code?: string; message?: string }
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? '문제가 생겼어요. 잠시 후 다시 시도해주세요.')
  }
  return json as T
}

export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : '문제가 생겼어요. 잠시 후 다시 시도해주세요.')
