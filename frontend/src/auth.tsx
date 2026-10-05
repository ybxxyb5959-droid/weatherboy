import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import { resetCharacterCache } from './lib/character'
import { disablePush } from './lib/push'
import type { Me } from './types'

interface AuthState {
  me: Me | null
  loading: boolean
  /** 로그인 여부를 확인하지 못했다(오프라인/서버 오류). 로그아웃이 아니라 다시 시도가 필요한 상태 */
  connectError: boolean
  refresh: () => Promise<Me | null>
  startGuest: () => Promise<Me>
  logout: () => Promise<void>
  /** 회원 탈퇴: 서버의 내 모든 데이터를 지우고 로그아웃 상태가 된다 */
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// 첫 설정 화면은 없다: 처음 들어오면 기본 설정 + 빈 옷장으로 바로 시작한다(옷장을 채우기 전엔 일반 추천).
// 위치/알림 허용은 홈 화면의 안내 카드와 설정 화면에서 나중에 할 수 있다.
async function ensureOnboarded(m: Me): Promise<Me> {
  if (m.onboardingDone) return m
  await api('POST', '/api/onboarding/complete', { skip: true })
  return api<Me>('GET', '/api/me')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectError, setConnectError] = useState(false)

  const refresh = useCallback(async () => {
    try {
      // 서버가 잠들어 있다 깨어나는 첫 요청은 오래 걸리니(최대 약 1분) 넉넉히 기다리고 몇 번 다시 시도한다
      let m = await api<Me>('GET', '/api/me', undefined, { timeoutMs: 30_000, retries: 3 })
      m = await ensureOnboarded(m)
      setMe(m)
      setConnectError(false)
      return m
    } catch (e) {
      // 401 = 로그인 안 됨. 네트워크/서버 오류는 로그아웃으로 오해하지 않도록 따로 알린다(이미 로그인했던 상태는 그대로 둔다).
      if (e instanceof ApiError && e.status === 401) {
        setMe(null)
        setConnectError(false)
      } else {
        console.warn('me failed', e)
        setConnectError(true)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startGuest = useCallback(async () => {
    const m = await ensureOnboarded(await api<Me>('POST', '/api/auth/guest'))
    setMe(m)
    return m
  }, [])

  const logout = useCallback(async () => {
    // 이 기기로 이 계정의 알림이 계속 오지 않게 먼저 구독을 푼다
    await disablePush().catch(() => undefined)
    await api('POST', '/api/auth/logout')
    resetCharacterCache() // 다음에 로그인하는 계정에 이 계정의 캐릭터가 잠깐 보이지 않게
    setMe(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    await disablePush().catch(() => undefined)
    await api('DELETE', '/api/me')
    resetCharacterCache()
    setMe(null)
  }, [])

  const value = useMemo(() => ({ me, loading, connectError, refresh, startGuest, logout, deleteAccount }), [me, loading, connectError, refresh, startGuest, logout, deleteAccount])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const v = useContext(AuthContext)
  if (!v) throw new Error('AuthProvider 가 필요해요')
  return v
}
