// Gemini 로 "구조화된 JSON" 을 받아오는 공용 도구 (사진으로 옷 등록, 말로 일정 등록에서 쓴다).
// 원칙: AI 는 입력을 채워줄 뿐이다. 응답은 항상 zod 로 다시 검증하고, 사용자가 확인한 뒤에만 저장한다.
// 옷차림 판단(무엇을 입을지)은 계속 Rule Engine 이 한다.
import type { ZodType } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../db.js'
import { AppError } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import { aiEnabled } from './explain.js'
import { currentAiScope } from './aiScope.js'

const TIMEOUT_MS = 20_000

export interface GeminiImage {
  mimeType: string
  /** base64 (data: 접두사 없이) */
  base64: string
}

async function log(status: 'SUCCESS' | 'FAILED', started: number, message?: string) {
  try {
    const scope = currentAiScope() // 요청 안에서 불렀다면 누가 어떤 종류로 불렀는지 같이 남긴다
    await prisma.aiCallLog.create({ data: { model: env.GEMINI_MODEL || 'none', status, fallback: false, durationMs: Date.now() - started, message: message?.slice(0, 300), userId: scope?.userId, kind: scope?.kind } })
  } catch (e) {
    logger.warn({ err: String(e) }, 'ai log write failed')
  }
}

export const aiDisabledError = () => new AppError(503, 'AI_DISABLED', 'AI 기능은 아직 준비 중이에요.')

/**
 * @param schema Gemini responseSchema (OpenAPI 부분집합, type 은 대문자)
 * @param validate 응답을 다시 검증하는 zod 스키마. 통과하지 못하면 AI 실패로 본다.
 */
export async function geminiJson<T>(opts: { prompt: string; image?: GeminiImage; schema: object; validate: ZodType<T>; fetchImpl?: typeof fetch }): Promise<T> {
  if (!aiEnabled()) throw aiDisabledError()
  const started = Date.now()
  const parts: object[] = [{ text: opts.prompt }]
  if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.base64 } })
  try {
    const res = await (opts.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: opts.schema, temperature: 0 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`gemini http ${res.status}`)
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('gemini empty response')
    const parsed = opts.validate.safeParse(JSON.parse(text))
    if (!parsed.success) throw new Error('gemini response failed validation')
    await log('SUCCESS', started)
    return parsed.data
  } catch (e) {
    await log('FAILED', started, e instanceof Error ? e.message : String(e))
    throw new AppError(502, 'AI_FAILED', 'AI가 답을 못 만들었어요. 잠시 후 다시 시도해주세요.')
  }
}
