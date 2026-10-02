// Gemini 는 "설명 문장"만 만든다. 옷/우산/마스크 판단은 Rule Engine 결과이며 AI 가 바꿀 수 없다.
// Gemini generateContent: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   헤더 x-goog-api-key, 본문 { contents: [{ parts: [{ text }] }] }, 응답 candidates[0].content.parts[0].text
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import type { EngineResult } from '../../rules/outfitEngine.js'
import { logger } from '../../utils/logger.js'

export const aiEnabled = () => env.AI_ENABLED && !!env.GEMINI_API_KEY && !!env.GEMINI_MODEL

export function templateExplanation(r: Pick<EngineResult, 'headline' | 'sub'>): string {
  return `${r.headline}. ${r.sub}.`
}

/** Rule Engine 결과 중 문장화에 필요한 사실만 넘긴다 (새 수치 생성 금지). */
export function aiInput(r: EngineResult) {
  return {
    items: r.items.map((i) => i.label),
    needOuter: r.needOuter,
    needUmbrella: r.needUmbrella,
    needMask: r.needMask,
    headline: r.headline,
    sub: r.sub,
    reasons: r.reasons,
  }
}

async function log(status: 'SUCCESS' | 'FAILED', fallback: boolean, started: number, message?: string) {
  try {
    await prisma.aiCallLog.create({ data: { model: env.GEMINI_MODEL || 'none', status, fallback, durationMs: Date.now() - started, message: message?.slice(0, 300) } })
  } catch (e) {
    logger.warn({ err: String(e) }, 'ai log write failed')
  }
}

/** AI 비활성: null. AI 실패: 결정론적 템플릿(fallback). */
export async function explain(r: EngineResult, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!aiEnabled()) return null
  const started = Date.now()
  const prompt =
    '다음 JSON은 옷차림 추천 결과다. 이 내용만 사용해 친근한 한국어 한두 문장으로 설명해라. ' +
    '새로운 기온, 확률, 수치, 옷을 만들어내지 말고 JSON에 없는 내용은 말하지 마라.\n' +
    JSON.stringify(aiInput(r))
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`gemini http ${res.status}`)
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('gemini empty response')
    await log('SUCCESS', false, started)
    return text.slice(0, 300)
  } catch (e) {
    await log('FAILED', true, started, e instanceof Error ? e.message : String(e))
    return templateExplanation(r)
  }
}
