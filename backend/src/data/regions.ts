// 자동완성용 내장 지역 목록 (시/도 + 시/군/구).
// 카카오 Local 은 한 글자("서") 검색에 지역이 아닌 주변 장소를 돌려주므로 지역 자동완성은 이 목록으로 한다.
// 선택된 이름은 /api/geocode (카카오 주소검색)로 좌표를 구한다.
export interface RegionEntry {
  /** 화면/검색에 쓰는 이름. 예: '서울', '서울 마포구', '제주 서귀포시' */
  name: string
  sido: string
  /** 시/군/구 이름. 시/도 자체이면 null */
  district: string | null
}

const SIDO_ALIASES: Record<string, string[]> = {
  서울: ['서울특별시', '서울시'],
  부산: ['부산광역시', '부산시'],
  대구: ['대구광역시', '대구시'],
  인천: ['인천광역시', '인천시'],
  광주: ['광주광역시', '광주시'],
  대전: ['대전광역시', '대전시'],
  울산: ['울산광역시', '울산시'],
  세종: ['세종특별자치시', '세종시'],
  경기: ['경기도'],
  강원: ['강원도', '강원특별자치도'],
  충북: ['충청북도'],
  충남: ['충청남도'],
  전북: ['전라북도', '전북특별자치도'],
  전남: ['전라남도'],
  경북: ['경상북도'],
  경남: ['경상남도'],
  제주: ['제주도', '제주특별자치도'],
}

const DISTRICTS: Record<string, string> = {
  서울: '종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구',
  부산: '중구 서구 동구 영도구 부산진구 동래구 남구 북구 해운대구 사하구 금정구 강서구 연제구 수영구 사상구 기장군',
  대구: '중구 동구 서구 남구 북구 수성구 달서구 달성군 군위군',
  인천: '제물포구 영종구 미추홀구 연수구 남동구 부평구 계양구 서해구 검단구 강화군 옹진군',
  광주: '동구 서구 남구 북구 광산구',
  대전: '동구 중구 서구 유성구 대덕구',
  울산: '중구 남구 동구 북구 울주군',
  세종: '',
  경기: '수원시 성남시 의정부시 안양시 부천시 광명시 평택시 동두천시 안산시 고양시 과천시 구리시 남양주시 오산시 시흥시 군포시 의왕시 하남시 용인시 파주시 이천시 안성시 김포시 화성시 광주시 양주시 포천시 여주시 연천군 가평군 양평군',
  강원: '춘천시 원주시 강릉시 동해시 태백시 속초시 삼척시 홍천군 횡성군 영월군 평창군 정선군 철원군 화천군 양구군 인제군 고성군 양양군',
  충북: '청주시 충주시 제천시 보은군 옥천군 영동군 증평군 진천군 괴산군 음성군 단양군',
  충남: '천안시 공주시 보령시 아산시 서산시 논산시 계룡시 당진시 금산군 부여군 서천군 청양군 홍성군 예산군 태안군',
  전북: '전주시 군산시 익산시 정읍시 남원시 김제시 완주군 진안군 무주군 장수군 임실군 순창군 고창군 부안군',
  전남: '목포시 여수시 순천시 나주시 광양시 담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군',
  경북: '포항시 경주시 김천시 안동시 구미시 영주시 영천시 상주시 문경시 경산시 의성군 청송군 영양군 영덕군 청도군 고령군 성주군 칠곡군 예천군 봉화군 울진군 울릉군',
  경남: '창원시 진주시 통영시 사천시 김해시 밀양시 거제시 양산시 의령군 함안군 창녕군 고성군 남해군 하동군 산청군 함양군 거창군 합천군',
  제주: '제주시 서귀포시',
}

export const REGIONS: RegionEntry[] = Object.keys(DISTRICTS).flatMap((sido) => [
  { name: sido, sido, district: null },
  ...DISTRICTS[sido]!.split(' ')
    .filter(Boolean)
    .map((d) => ({ name: `${sido} ${d}`, sido, district: d })),
])

const strip = (s: string) => s.replace(/\s+/g, '')
/** '마포구' -> '마포', '수원시' -> '수원' (구/시/군 한 글자만 있는 이름은 유지) */
const stem = (d: string) => (d.length > 2 ? d.replace(/(특별시|광역시|시|군|구)$/, '') : d)

/**
 * 입력한 글자로 시작하는 지역을 찾는다.
 *  1순위: 시/도 (서울, 서울특별시, 제주도 ...)
 *  2순위: 시/군/구 이름이 입력으로 시작 ('마' -> 마포구, '수' -> 수원시)
 *  3순위: '서울 마' 처럼 시/도 + 구 이름 접두
 */
export function suggestRegions(query: string, limit = 8): RegionEntry[] {
  const q = strip(query)
  if (!q) return []
  const scored: { r: RegionEntry; score: number; order: number }[] = []
  REGIONS.forEach((r, order) => {
    const full = strip(r.name)
    const aliases = SIDO_ALIASES[r.sido] ?? []
    let score = -1
    if (r.district === null) {
      if (full.startsWith(q) || aliases.some((a) => strip(a).startsWith(q))) score = 0
    } else {
      const d = r.district
      if (d.startsWith(q) || stem(d).startsWith(q)) score = 1
      else if (full.startsWith(q) || aliases.some((a) => strip(a + d).startsWith(q))) score = 2
    }
    if (score >= 0) scored.push({ r, score, order })
  })
  scored.sort((a, b) => a.score - b.score || a.order - b.order)
  return scored.slice(0, limit).map((s) => s.r)
}

// 카카오가 시/도 이름만으로는 엉뚱한 곳을 주는 경우(광주 -> 경기 광주시, 전남 -> 전남광주통합특별시 중심)가 있어
// 좌표를 구할 때 대표 지역으로 검색한다.
const GEOCODE_ANCHOR: Record<string, string> = { 광주: '광주 동구', 전남: '전남 목포시' }

/** 내장 목록에 있는 정확한 이름이면 해당 항목 + 좌표 검색에 쓸 질의를 돌려준다. */
export function findRegion(name: string): { entry: RegionEntry; query: string } | null {
  const entry = REGIONS.find((r) => r.name === name.trim())
  if (!entry) return null
  return { entry, query: (entry.district === null && GEOCODE_ANCHOR[entry.sido]) || entry.name }
}
