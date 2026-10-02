// Kakao Login REST API (https://developers.kakao.com/docs/ko/kakaologin/rest-api)
//  - 인가 코드: GET  https://kauth.kakao.com/oauth/authorize  (client_id, redirect_uri, response_type=code, state)
//  - 토큰:      POST https://kauth.kakao.com/oauth/token      (grant_type, client_id, redirect_uri, code, client_secret)
//  - 사용자:    GET  https://kapi.kakao.com/v2/user/me        (Authorization: Bearer)
import { env } from '../../config/env.js'
import { AppError } from '../../utils/errors.js'

export interface KakaoProfile {
  id: string
  nickname: string | null
  profileImageUrl: string | null
  email: string | null
}

export const kakaoConfigured = () => !!(env.KAKAO_REST_API_KEY && env.KAKAO_REDIRECT_URI)

export function buildAuthorizeUrl(state: string): string {
  const u = new URL('https://kauth.kakao.com/oauth/authorize')
  u.searchParams.set('client_id', env.KAKAO_REST_API_KEY)
  u.searchParams.set('redirect_uri', env.KAKAO_REDIRECT_URI)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('state', state)
  return u.toString()
}

interface TokenResponse {
  access_token?: string
}
interface MeResponse {
  id?: number | string
  kakao_account?: { email?: string; profile?: { nickname?: string; profile_image_url?: string } }
  properties?: { nickname?: string; profile_image?: string }
}

/** code -> access token -> 프로필. access token 은 저장/로그 하지 않고 즉시 폐기한다. */
export async function fetchKakaoProfile(code: string, fetchImpl: typeof fetch = fetch): Promise<KakaoProfile> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.KAKAO_REST_API_KEY,
    redirect_uri: env.KAKAO_REDIRECT_URI,
    code,
  })
  if (env.KAKAO_CLIENT_SECRET) body.set('client_secret', env.KAKAO_CLIENT_SECRET)

  const tokenRes = await fetchImpl('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  })
  if (!tokenRes.ok) throw new AppError(502, 'KAKAO_TOKEN_FAILED', '카카오 로그인에 실패했어요.')
  const token = (await tokenRes.json()) as TokenResponse
  if (!token.access_token) throw new AppError(502, 'KAKAO_TOKEN_FAILED', '카카오 로그인에 실패했어요.')

  const meRes = await fetchImpl('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!meRes.ok) throw new AppError(502, 'KAKAO_PROFILE_FAILED', '카카오 사용자 정보를 가져오지 못했어요.')
  const me = (await meRes.json()) as MeResponse
  if (me.id == null) throw new AppError(502, 'KAKAO_PROFILE_FAILED', '카카오 사용자 정보를 가져오지 못했어요.')
  const profile = me.kakao_account?.profile
  return {
    id: String(me.id),
    nickname: profile?.nickname ?? me.properties?.nickname ?? null,
    profileImageUrl: profile?.profile_image_url ?? me.properties?.profile_image ?? null,
    email: me.kakao_account?.email ?? null,
  }
}
