import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './api'

export interface Async<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
  setData: (v: T | null) => void
}

/**
 * 마운트 시 fetcher 를 실행한다. reload() 로 다시 불러온다.
 * key 가 바뀌면 다시 불러온다 (예: 보는 지역이 바뀔 때). 늦게 도착한 이전 응답은 무시한다.
 */
export function useAsync<T>(fetcher: () => Promise<T>, key = ''): Async<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef(fetcher)
  const seq = useRef(0)
  useEffect(() => {
    fetchRef.current = fetcher
  })

  const reload = useCallback(() => {
    const mine = ++seq.current
    setLoading(true)
    setError(null)
    fetchRef
      .current()
      .then((d) => {
        if (mine === seq.current) setData(d)
      })
      .catch((e) => {
        if (mine === seq.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload, key])

  return { data, error, loading, reload, setData }
}
