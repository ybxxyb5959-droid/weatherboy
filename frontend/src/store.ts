import { useCallback, useState } from 'react'

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function useStored<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [key],
  )
  return [value, set]
}

export type Sensitivity = '추위 많이 탐' | '보통' | '더위 많이 탐'

/** 하루 패턴. 시간은 'HH:mm', 모르면 null. days: 0=일 ~ 6=토 */
export interface Routine {
  /** 외출 시간 */
  outAt: string | null
  /** 들어오는 시간 */
  homeAt: string | null
  days: number[]
}

export const defaultRoutine: Routine = { outAt: null, homeAt: null, days: [1, 2, 3, 4, 5] }

export interface Settings {
  sensitivity: Sensitivity
  location: string
  notifyEvent: boolean
  notifyChange: boolean
  routine?: Routine
}

export const defaultSettings: Settings = {
  sensitivity: '보통',
  location: '서울 마포구',
  notifyEvent: true,
  notifyChange: true,
}
