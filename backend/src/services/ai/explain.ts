// Gemini 는 "설명 문장"만 만든다. 옷/우산/마스크 판단은 Rule Engine 결과이며 AI 가 바꿀 수 없다.
// Gemini generateContent: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   헤더 x-goog-api-key, 본문 { contents: [{ parts: [{ text }] }] }, 응답 candidates[0].content.parts[0].text
import { env } from '../../config/env.js'
import { colorIssueTip } from '../../rules/colorHarmony.js'
import type { EngineResult } from '../../rules/outfitEngine.js'
import { recordAiCall } from './aiLog.js'
import { currentAiScope } from './aiScope.js'
import { reserveAi } from './aiQuota.js'
import { tokenUsage, type TokenUsage } from './aiTokens.js'

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
    // 색이 어색한 조합일 때만(상하의가 같은 색, 쨍한 색 충돌, 무늬 겹침). 날씨 때문에 피할 수 없었던 조합이다.
    ...(r.colorIssue ? { colorIssue: r.colorIssue, colorTip: colorIssueTip[r.colorIssue] } : {}),
  }
}

// 자동 설명은 추천 요청의 뒤에서 돌아서, 호출하는 쪽이 사용자·종류(explain)를 aiScope 로 묶어 준다
const log = (status: 'SUCCESS' | 'FAILED', fallback: boolean, started: number, usage: TokenUsage, message?: string, reservationId?: string) =>
  recordAiCall({ model: env.GEMINI_MODEL || 'none', status, fallback, durationMs: Date.now() - started, ...usage, message }, reservationId)

/** AI 비활성: null. AI 실패: 결정론적 템플릿(fallback). */
export async function explain(r: EngineResult, fetchImpl: typeof fetch = fetch): Promise<{ text: string; source: 'ai' | 'template' } | null> {
  if (!aiEnabled()) return null
  const scope = currentAiScope()
  const reservation = scope ? await reserveAi(scope.userId, 'explain') : null
  if (reservation && !reservation.ok) return { text: templateExplanation(r), source: 'template' }
  const started = Date.now()
  let usage: TokenUsage = {}
  const prompt =
    '다음 JSON은 옷차림 추천 결과다. 이 내용만 사용해 친근한 한국어 한두 문장으로 설명해라. ' +
    '새로운 기온, 확률, 수치, 옷을 만들어내지 말고 JSON에 없는 내용은 말하지 마라. ' +
    'colorIssue 가 있으면 마지막에 한 문장으로, colorTip 의 뜻을 살려 부담 없는 말투로 색을 보완하는 방법을 알려줘라(새 옷을 사라고 하지 말고 겉옷·신발·가방 같은 소품 색 정도로).\n' +
    JSON.stringify(aiInput(r))
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: Math.min(512, env.GEMINI_MAX_OUTPUT_TOKENS) } }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`gemini http ${res.status}`)
    const json = (await res.json()) as { usageMetadata?: unknown; candidates?: { content?: { parts?: { text?: string }[] } }[] }
    usage = tokenUsage(json.usageMetadata)
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('gemini empty response')
    await log('SUCCESS', false, started, usage, undefined, reservation?.ok ? reservation.id : undefined)
    return { text: text.slice(0, 300), source: 'ai' }
  } catch (e) {
    await log('FAILED', true, started, usage, 'gemini explanation failed', reservation?.ok ? reservation.id : undefined)
    return { text: templateExplanation(r), source: 'template' }
  }
}
