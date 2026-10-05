/**
 * 접속자 IP 를 읽기 위해 믿는 프록시 단계 수. 설정값(TRUST_PROXY_HOPS)이 있으면 그 값.
 * Render 는 Vercel -> Cloudflare -> Render 내부 순으로 4단계(운영 /api/net-check 로 확인함: 내 IP, Vercel, Cloudflare, 내부). 그 밖에는 1.
 */
export function trustProxyHops(configured: number | undefined, onRender: boolean): number {
  return configured ?? (onRender ? 4 : 1)
}
