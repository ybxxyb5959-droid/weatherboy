import { useEffect, useState } from 'react'
import { api } from '../api'

export interface AiUsage {
  /** false 면 서버 전체가 오늘 AI 사용 상한을 넘어서 AI 기능을 잠시 쉰다 */
  open: boolean
  photo: { used: number; limit: number; remainingPct: number; isNewUser: boolean } | null
}

/**
 * 오늘 AI 사용량(남은 비율)을 가져온다. enabled 가 true 가 될 때(예: 메뉴를 열 때)와 refreshKey 가 바뀔 때(예: 사진을 한 번 올린 뒤) 다시 읽는다.
 * 못 읽으면 null: 막대를 그리지 않고, 사진 기능도 막지 않는다.
 */
export function useAiUsage(enabled = true, refreshKey: unknown = 0): AiUsage | null {
  const [usage, setUsage] = useState<AiUsage | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    api<AiUsage>('GET', '/api/ai/usage')
      .then((u) => alive && setUsage(u))
      .catch(() => alive && setUsage(null))
    return () => {
      alive = false
    }
  }, [enabled, refreshKey])
  return usage
}

/** 사진 인식을 지금 쓸 수 없는가(서버 전체가 쉬거나, 내 오늘 몫을 다 씀) */
export const photoBlocked = (u: AiUsage | null): boolean => !!u && (!u.open || (u.photo !== null && u.photo.remainingPct <= 0))
