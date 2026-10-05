import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'

/** 디스코드로 한 줄 알림(웹훅 주소가 있을 때만). 실패해도 저장 흐름에는 영향이 없다. */
async function postDiscord(content: string): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: 내용에 @everyone 같은 게 있어도 멘션되지 않게 한다
      body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) logger.warn({ status: res.status }, 'owner notify failed')
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'owner notify error')
  }
}

const HIDDEN = '_(내용은 관리자 화면에서 확인)_'
/** 후기·의견 본문은 기본적으로 디스코드로 보내지 않는다(개인정보처리방침과 일치). DISCORD_INCLUDE_MESSAGE=true 일 때만 보낸다. */
export const bodyFor = (message: string, empty = ''): string => (env.DISCORD_INCLUDE_MESSAGE ? message || empty : HIDDEN)

/** 새 앱 후기. 개인정보는 보내지 않는다: 닉네임/이메일 없이 짧은 사용자 코드만. */
export async function notifyNewReview(r: { rating: number; message: string; code: string; provider: string | null; total: number }): Promise<void> {
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)
  await postDiscord([`📝 **새 후기** ${stars} (${r.rating}/5)`, bodyFor(r.message, '_(내용 없이 별점만)_'), `— 사용자 ${r.code}${r.provider ? ` · ${r.provider}` : ''} · 누적 후기 ${r.total}개`].join('\n'))
}

const KIND_LABEL = { BUG: '🐞 불편/오류', IDEA: '💡 제안', OTHER: '💬 기타' } as const

/** 새 의견·제보(여러 번 보낼 수 있는 쪽). */
export async function notifyNewSupport(r: { kind: keyof typeof KIND_LABEL; message: string; code: string; provider: string | null }): Promise<void> {
  await postDiscord([`${KIND_LABEL[r.kind]} **새 의견**`, bodyFor(r.message), `— 사용자 ${r.code}${r.provider ? ` · ${r.provider}` : ''}`].join('\n'))
}

// ───── 서버 오류 알림: 처리되지 않은 오류(500)가 나면 운영자에게 한 줄 알린다 ─────
const lastSent = new Map<string, number>()
const sentLog: number[] = []
const SAME_ERROR_MS = 10 * 60_000 // 같은 오류는 10분에 한 번만
const MAX_PER_HOUR = 20 // 오류가 쏟아져도 시간당 20건까지만

/** 순수 판단: 이 오류를 지금 알릴까(같은 오류 반복·폭주 방지). 알리기로 하면 기록한다. */
export function shouldAlertError(key: string, now: number): boolean {
  while (sentLog.length && now - sentLog[0]! > 3600_000) sentLog.shift()
  if (sentLog.length >= MAX_PER_HOUR) return false
  const prev = lastSent.get(key)
  if (prev !== undefined && now - prev < SAME_ERROR_MS) return false
  lastSent.set(key, now)
  sentLog.push(now)
  if (lastSent.size > 200) for (const [k, t] of lastSent) if (now - t > SAME_ERROR_MS) lastSent.delete(k)
  return true
}
export const resetErrorAlerts = () => {
  lastSent.clear()
  sentLog.length = 0
}

/** 경로에서 id 처럼 보이는 부분은 가린다(사용자 데이터가 알림에 섞이지 않게) */
export const routeLabel = (path: string): string => path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/:id').replace(/\/\d+/g, '/:n').slice(0, 80)

/** 처리되지 않은 서버 오류 알림. 오류 이름·코드와 경로만 보낸다(오류 메시지에는 사용자 값이 들어갈 수 있어 제외). */
export async function notifyServerError(r: { method: string; path: string; name: string; code?: string }): Promise<void> {
  const route = routeLabel(r.path)
  if (!shouldAlertError(`${r.method} ${route} ${r.name} ${r.code ?? ''}`, Date.now())) return
  const commit = (process.env.RENDER_GIT_COMMIT ?? '').slice(0, 7)
  await postDiscord(`🚨 **서버 오류** ${r.method} ${route}\n${r.name}${r.code ? ` (${r.code})` : ''}${commit ? ` · 커밋 ${commit}` : ''}`)
}
