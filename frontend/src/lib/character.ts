import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Accessories } from '../components/CharacterDecor'
import type { WornItem } from '../components/StickPerson'

export interface Share {
  name: string
  count: number
  share: number
}
export interface TitleInfo {
  key: string
  name: string
  tagline: string
  rule: string
}
export interface CharacterData {
  analysis: { count: number; ready: boolean; need: number; title: TitleInfo | null; strength: number; colors: Share[]; types: Share[]; patterns: Share[] }
  config: Accessories
  catalog: { slot: keyof Accessories; label: string; items: { id: string; label: string }[] }[]
  titles: TitleInfo[]
}

type Wear = { top?: WornItem; bottom?: WornItem; outer?: WornItem }

/** 캐릭터 화면에서 칭호별로 입는 기본 복장 (칭호가 없을 땐 기본 복장) */
export const PERSONA_WEAR: Record<string, Wear> = {
  DARK_CHILD: { top: { type: '후드티', color: '검정' }, bottom: { type: '바지', color: '검정' } },
  MINIMALIST: { top: { type: '긴팔', color: '흰색' }, bottom: { type: '바지', color: '회색' } },
  PATTERN_MASTER: { top: { type: '셔츠', color: '하늘색', pattern: '체크' }, bottom: { type: '바지', color: '네이비', pattern: '줄무늬' } },
  PASTEL_FAIRY: { top: { type: '니트', color: '분홍' }, bottom: { type: '치마', color: '베이지' } },
  HOODIE_ADDICT: { top: { type: '후드티', color: '초록' }, bottom: { type: '바지', color: '파랑' } },
  WARM_BEAR: { top: { type: '니트', color: '갈색' }, bottom: { type: '바지', color: '베이지' } },
  TEE_ONLY: { top: { type: '반팔', color: '주황' }, bottom: { type: '반바지', color: '파랑' } },
  BALANCED: { top: { type: '맨투맨', color: '회색' }, bottom: { type: '바지', color: '파랑' } },
}
export const BASIC_WEAR: Wear = { top: { type: '반팔', color: '흰색' }, bottom: { type: '바지', color: '파랑' } }

// 홈과 캐릭터 화면이 같은 캐릭터를 쓰도록 한 번 불러온 값을 공유한다 (꾸미면 홈의 캐릭터도 바로 같이 바뀐다)
let cache: CharacterData | null = null
const listeners = new Set<(d: CharacterData) => void>()
const publish = (d: CharacterData) => {
  cache = d
  listeners.forEach((l) => l(d))
}

export function useCharacter() {
  const [data, setData] = useState<CharacterData | null>(cache)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setError('')
    api<CharacterData>('GET', '/api/character')
      .then(publish)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '캐릭터를 불러오지 못했어요.'))
  }, [])

  useEffect(() => {
    listeners.add(setData)
    reload() // 옷을 담거나 지웠을 수 있으니 열 때마다 최신 칭호로 갱신(그 사이는 저장해 둔 값을 보여준다)
    return () => {
      listeners.delete(setData)
    }
  }, [reload])

  /** 꾸미기 저장. 성공하면 모든 화면의 캐릭터가 같이 바뀐다. */
  const saveConfig = useCallback(async (config: Accessories) => {
    const body: Record<string, string | null> = {}
    for (const k of ['hat', 'hairpin', 'glasses', 'neck', 'extra'] as const) body[k] = config[k] ?? null
    publish(await api<CharacterData>('PUT', '/api/character', { config: body }))
  }, [])

  return { data, error, reload, saveConfig }
}
