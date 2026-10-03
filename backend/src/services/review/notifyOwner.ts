import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'

/**
 * 새 후기를 디스코드로 알려 준다(웹훅 주소가 있을 때만). 실패해도 후기 저장에는 영향이 없다.
 * 개인정보는 보내지 않는다: 닉네임/이메일 없이 짧은 사용자 코드만.
 */
export async function notifyNewReview(r: { rating: number; message: string; code: string; provider: string | null; total: number }): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)
  const content = [`📝 **새 후기** ${stars} (${r.rating}/5)`, r.message ? r.message : '_(내용 없이 별점만)_', `— 사용자 ${r.code}${r.provider ? ` · ${r.provider}` : ''} · 누적 후기 ${r.total}개`].join('\n').slice(0, 1900)
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: 후기 내용에 @everyone 같은 게 있어도 멘션되지 않게 한다
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) logger.warn({ status: res.status }, 'review notify failed')
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'review notify error')
  }
}
