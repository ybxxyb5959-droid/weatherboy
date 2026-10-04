import { env } from '../../config/env.js'

// 브라우저가 주는 푸시 주소는 각 브라우저 벤더의 푸시 서비스 도메인뿐이다.
// 서버가 임의 주소로 요청을 보내는 것(SSRF)을 막기 위해 이 목록만 받는다.
const ALLOWED_SUFFIXES = [
  'fcm.googleapis.com', // Chrome / Android / TWA
  'updates.push.services.mozilla.com', // Firefox
  'push.apple.com', // Safari (web.push.apple.com)
  'notify.windows.com', // Edge (Windows)
]
const TEST_HOSTS = ['push.example']

export function isAllowedPushEndpoint(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  if (env.NODE_ENV === 'test' && TEST_HOSTS.includes(host)) return true
  if (u.protocol !== 'https:') return false
  if (u.port && u.port !== '443') return false
  return ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))
}
