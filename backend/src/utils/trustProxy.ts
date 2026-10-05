/** 접속자 IP 를 읽기 위해 믿는 프록시 단계 수. Render 는 앞에 Vercel 이 하나 더 있어서 2, 그 밖에는 1. 설정값(TRUST_PROXY_HOPS)이 있으면 그 값 */
export function trustProxyHops(configured: number | undefined, onRender: boolean): number {
  return configured ?? (onRender ? 2 : 1)
}
