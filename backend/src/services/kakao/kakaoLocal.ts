// Kakao Local API (https://developers.kakao.com/docs/ko/local/dev-guide)
//  - GET https://dapi.kakao.com/v2/local/search/address.json?query=
//  - GET https://dapi.kakao.com/v2/local/search/keyword.json?query=
//  - Authorization: KakaoAK ${REST_API_KEY}
//  - documents[]: address_name, x(경도), y(위도) / keyword 는 place_name 추가
import { env } from '../../config/env.js'
import { AppError } from '../../utils/errors.js'
import { REGIONS } from '../../data/regions.js'
import { latLngToGrid } from '../../utils/grid.js'

export interface GeocodeResult {
  name: string
  address: string
  latitude: number
  longitude: number
  regionSido: string
  regionDistrict: string | null
  gridNx: number
  gridNy: number
}

interface AddressDoc {
  address_name?: string
  x?: string
  y?: string
  address?: { region_1depth_name?: string; region_2depth_name?: string } | null
  road_address?: { region_1depth_name?: string; region_2depth_name?: string } | null
}
interface KeywordDoc {
  place_name?: string
  address_name?: string
  x?: string
  y?: string
}

const SIDO_PREFIXES: [string, string][] = [
  ['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'], ['광주', '광주'], ['대전', '대전'], ['울산', '울산'],
  ['세종', '세종'], ['경기', '경기'], ['강원', '강원'], ['충청북', '충북'], ['충북', '충북'], ['충청남', '충남'], ['충남', '충남'],
  ['전라북', '전북'], ['전북', '전북'], ['전라남', '전남'], ['전남', '전남'], ['경상북', '경북'], ['경북', '경북'],
  ['경상남', '경남'], ['경남', '경남'], ['제주', '제주'],
]

/** "서울특별시"/"경기도"/"제주특별자치도" -> AirKorea sidoName 형식("서울","경기","제주") */
export function normalizeSido(raw: string | undefined | null): string | null {
  if (!raw) return null
  const hit = SIDO_PREFIXES.find(([p]) => raw.startsWith(p))
  return hit ? hit[1] : null
}

const localKey = () => env.KAKAO_LOCAL_REST_API_KEY || env.KAKAO_REST_API_KEY
export const kakaoLocalConfigured = () => !!localKey()

async function call<T>(path: string, query: string, fetchImpl: typeof fetch): Promise<{ documents: T[] }> {
  const res = await fetchImpl(`https://dapi.kakao.com/v2/local/search/${path}?${new URLSearchParams({ query, size: '5' })}`, {
    headers: { Authorization: `KakaoAK ${localKey()}` },
  })
  if (!res.ok) throw new AppError(502, 'GEOCODE_UNAVAILABLE', '위치 검색을 사용할 수 없어요.')
  return (await res.json()) as { documents: T[] }
}

function build(name: string, address: string, x?: string, y?: string, sido?: string | null, district?: string | null): GeocodeResult | null {
  const lng = Number(x)
  const lat = Number(y)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const parts = address.split(/\s+/)
  const regionSido = normalizeSido(sido ?? parts[0])
  if (!regionSido) return null
  const { nx, ny } = latLngToGrid(lat, lng)
  return {
    name,
    address,
    latitude: lat,
    longitude: lng,
    regionSido,
    regionDistrict: district ?? parts[1] ?? null,
    gridNx: nx,
    gridNy: ny,
  }
}

export async function geocode(q: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult[]> {
  if (!kakaoLocalConfigured()) throw new AppError(503, 'GEOCODE_UNAVAILABLE', '위치 검색이 설정되지 않았어요.')
  const out: GeocodeResult[] = []
  const addr = await call<AddressDoc>('address.json', q, fetchImpl)
  for (const d of addr.documents) {
    const a = d.address ?? d.road_address
    const r = build(d.address_name ?? q, d.address_name ?? q, d.x, d.y, a?.region_1depth_name, a?.region_2depth_name)
    if (r) out.push(r)
  }
  if (out.length === 0) {
    const kw = await call<KeywordDoc>('keyword.json', q, fetchImpl)
    for (const d of kw.documents) {
      const r = build(d.place_name ?? q, d.address_name ?? q, d.x, d.y)
      if (r) out.push(r)
    }
  }
  return out
}

export interface ReverseRegion {
  name: string
  sido: string
  district: string | null
}

interface RegionCodeDoc {
  region_type?: string
  region_1depth_name?: string
  region_2depth_name?: string
}

/** 카카오 행정구역 이름 -> 서비스에서 쓰는 이름(예: '서울특별시','마포구' -> '서울 마포구'). */
export function canonicalRegion(region1: string, region2: string): ReverseRegion | null {
  if (!region1) return null
  // '수원시 영통구' -> '수원시' (서비스 지역 목록은 시 단위)
  const district = region2.trim().split(/\s+/)[0] || null
  let sido: string | null
  if (region1.startsWith('전남광주')) {
    // 카카오가 광주+전남을 한 이름으로 합쳐서 준다. 구 이름이 광주 목록에 있으면 광주, 아니면 전남.
    sido = district && REGIONS.some((r) => r.sido === '광주' && r.district === district) ? '광주' : '전남'
  } else {
    sido = normalizeSido(region1)
  }
  if (!sido) return null
  return { name: district ? `${sido} ${district}` : sido, sido, district }
}

/** 좌표 -> 행정구역. GET https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=경도&y=위도 */
export async function reverseGeocode(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<ReverseRegion | null> {
  if (!kakaoLocalConfigured()) throw new AppError(503, 'GEOCODE_UNAVAILABLE', '위치 검색이 설정되지 않았어요.')
  const res = await fetchImpl(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?${new URLSearchParams({ x: String(lng), y: String(lat) })}`, {
    headers: { Authorization: `KakaoAK ${localKey()}` },
  })
  if (!res.ok) throw new AppError(502, 'GEOCODE_UNAVAILABLE', '위치 검색을 사용할 수 없어요.')
  const docs = ((await res.json()) as { documents?: RegionCodeDoc[] }).documents ?? []
  const d = docs.find((x) => x.region_type === 'H') ?? docs[0]
  return d ? canonicalRegion(d.region_1depth_name ?? '', d.region_2depth_name ?? '') : null
}
