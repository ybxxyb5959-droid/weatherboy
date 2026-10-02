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

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
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
