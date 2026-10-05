// Gemini が返した利用量だけを保存する。本文や写真、推測した値は保存しない。
export interface TokenUsage {
  promptTokens?: number
  outputTokens?: number
  totalTokens?: number
  thoughtTokens?: number
}
export function tokenUsage(metadata: unknown): TokenUsage {
  if (!metadata || typeof metadata !== 'object') return {}
  const m = metadata as Record<string, unknown>
  const out: TokenUsage = {}
  const keys = { promptTokens: 'promptTokenCount', outputTokens: 'candidatesTokenCount', totalTokens: 'totalTokenCount', thoughtTokens: 'thoughtsTokenCount' } as const
  for (const [key, source] of Object.entries(keys)) {
    const value = m[source]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647) out[key as keyof TokenUsage] = value
  }
  return out
}
