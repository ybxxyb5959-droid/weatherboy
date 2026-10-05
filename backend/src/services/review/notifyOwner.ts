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
