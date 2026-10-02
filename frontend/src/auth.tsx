import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import type { Me } from './types'

interface AuthState {
  me: Me | null
  loading: boolean
  refresh: () => Promise<Me | null>
  startGuest: () => Promise<Me>
  logout: () => Promise<void>
  /** 회원 탈퇴: 서버의 내 모든 데이터를 지우고 로그아웃 상태가 된다 */
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>('GET', '/api/me')
      setMe(m)
      return m
    } catch (e) {
      // 401 = 로그인 안 됨. 그 외 오류도 일단 로그아웃 상태로 보여준다.
      if (!(e instanceof ApiError) || e.status !== 401) console.warn('me failed', e)
      setMe(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startGuest = useCallback(async () => {
    const m = await api<Me>('POST', '/api/auth/guest')
    setMe(m)
    return m
  }, [])

  const logout = useCallback(async () => {
    await api('POST', '/api/auth/logout')
    setMe(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    await api('DELETE', '/api/me')
    setMe(null)
  }, [])

  const value = useMemo(() => ({ me, loading, refresh, startGuest, logout, deleteAccount }), [me, loading, refresh, startGuest, logout, deleteAccount])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const v = useContext(AuthContext)
  if (!v) throw new Error('AuthProvider 가 필요해요')
  return v
}
