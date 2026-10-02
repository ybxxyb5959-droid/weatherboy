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
  /** 방해금지 시간: 이 시간에는 알림을 보내지 않는다(시작이 끝보다 늦으면 자정을 넘는 구간) */
  quiet?: Quiet
}

export interface Quiet {
  enabled: boolean
  start: string
  end: string
}

export const defaultQuiet: Quiet = { enabled: true, start: '23:00', end: '07:00' }

export const defaultSettings: Settings = {
  sensitivity: '보통',
  location: '서울 마포구',
  notifyEvent: true,
  notifyChange: true,
}
