// Web Push 구독 도구. 알림 허용 팝업은 requestPermission() 이 띄운다(반드시 사용자의 클릭 안에서 호출).
import { api } from '../api'

export type PushState = 'unsupported' | 'denied' | 'ask' | 'off' | 'on'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  return existing ?? navigator.serviceWorker.register('/sw.js')
}

/** 현재 상태: 미지원 / 차단됨 / 아직 안 물어봄(ask) / 허용했지만 구독 안 함(off) / 구독 중(on) */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'ask'
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type EnableResult = 'enabled' | 'denied' | 'unsupported' | 'no-server-key' | 'failed'

/** 알림 허용 팝업을 띄우고, 허용되면 푸시를 구독해서 서버에 등록한다. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return 'unsupported'
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (permission !== 'granted') return 'denied'
    const { publicKey } = await api<{ publicKey: string | null }>('GET', '/api/push/public-key')
    if (!publicKey) return 'no-server-key'
    const reg = await registration()
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
    await api('POST', '/api/push/subscribe', sub.toJSON())
    return 'enabled'
  } catch {
    return 'failed'
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await api('DELETE', '/api/push/subscribe', { endpoint }).catch(() => undefined)
}
