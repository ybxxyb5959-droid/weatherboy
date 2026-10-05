import { stdSerializers } from 'pino'

/**
 * 주소의 쿼리 값을 가린다: "/api/places/reverse?lat=37.5&lng=127" -> "/api/places/reverse?lat=***&lng=***".
 * 위치 좌표나 카카오 로그인 code 같은 값이 요청 로그에 남지 않게 하고, 어떤 항목이 왔는지(키)만 남긴다.
 */
export function maskQuery(url: string | undefined): string | undefined {
  if (!url) return url
  const i = url.indexOf('?')
  if (i < 0) return url
  const keys = url
    .slice(i + 1)
    .split('&')
    .filter(Boolean)
    .map((kv) => kv.split('=')[0])
  return keys.length ? `${url.slice(0, i)}?${keys.map((k) => `${k}=***`).join('&')}` : url.slice(0, i)
}

/** pino-http 요청 로그 직렬화: 기본 항목에서 쿼리 값을 가린다(url 과 query) */
export function maskedReqSerializer(req: Parameters<typeof stdSerializers.req>[0]) {
  const base = stdSerializers.req(req)
  return { ...base, url: maskQuery(base.url), query: undefined }
}
