import { useSyncExternalStore } from 'react'

// 크롬(안드로이드/PC)은 설치 가능해지면 beforeinstallprompt 를 한 번만 보낸다.
// React 가 뜨기 전에 올 수 있어서 main.tsx 에서 이 파일을 불러와 미리 붙잡아 둔다.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
  // 서비스워커가 없으면 일부 브라우저에서 설치 버튼이 안 뜬다(푸시 전용 sw.js 라 다른 동작은 없음)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    })
  }
}

export type Platform = 'kakao' | 'ios' | 'android' | 'other'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 설치 버튼용 상태: 바로 설치할 수 있는지(canPrompt), 이미 설치했는지(installed) */
export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false)
  const done = useSyncExternalStore(subscribe, () => installed, () => false)
  const prompt = async () => {
    if (!deferred) return false
    const ev = deferred
    await ev.prompt()
    const { outcome } = await ev.userChoice
    if (outcome === 'accepted') deferred = null
    emit()
    return outcome === 'accepted'
  }
  return { canPrompt, installed: done, prompt }
}

/** 카카오톡 안에서 열렸을 때 기본 브라우저로 다시 연다(앱 안 브라우저는 설치를 못 한다) */
export function openInExternalBrowser() {
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`
}
