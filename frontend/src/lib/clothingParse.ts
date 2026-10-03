// "검정 체크 맨투맨이랑 청바지" 같은 문장을 옷 목록으로 바꾼다. AI 없이 키워드 사전으로만 해석한다(빠르고, 오프라인에서도 되고, 결과가 항상 같다).
// 종류/색/무늬 이름은 서버·화면의 선택지(mocks/clothes.ts)와 같은 값을 돌려준다.

export interface ParsedClothing {
  type: string
  color: string
  pattern: string
  /** 문장에서 색을 못 찾아 '기타'로 둔 경우: 화면에서 고르라고 알려준다 */
  colorGuessed: boolean
}

export interface ParseResult {
  items: ParsedClothing[]
  /** 옷 종류를 못 찾은 조각(그대로 보여줘서 사용자가 알아채게 한다) */
  unknown: string[]
}

// 긴 말이 먼저 맞도록(반바지 > 바지, 후드티 > 후드) 아래에서 길이순으로 정렬해 쓴다.
const TYPES: Record<string, string[]> = {
  반팔: ['반팔', '반팔티', '반소매', '티셔츠', '티'],
  긴팔: ['긴팔', '긴팔티', '긴소매', '롱슬리브'],
  반팔셔츠: ['반팔셔츠', '반팔 셔츠', '반팔남방', '반팔 남방', '반팔블라우스', '하와이안셔츠', '알로하셔츠', '카라티', '피케셔츠', '폴로셔츠'],
  셔츠: ['셔츠', '와이셔츠', '남방', '블라우스'],
  맨투맨: ['맨투맨', '스웨트셔츠', '스웻셔츠'],
  니트: ['니트', '스웨터'],
  후드티: ['후드티', '후디', '후드', '후드집업', '집업'],
  바지: ['바지', '청바지', '슬랙스', '팬츠', '면바지', '츄리닝', '트레이닝', '조거', '데님', '와이드팬츠'],
  반바지: ['반바지', '숏팬츠', '쇼츠', '핫팬츠'],
  치마: ['치마', '스커트', '원피스'],
  바람막이: ['바람막이', '윈드브레이커', '윈드자켓'],
  자켓: ['데님 자켓', '데님자켓', '청자켓', '자켓', '재킷', '잠바', '점퍼', '블레이저', '야상', '바시티', '라이더'],
  가디건: ['니트 가디건', '니트가디건', '가디건', '카디건', '볼레로'],
  코트: ['코트', '트렌치', '트렌치코트', '롱코트'],
  패딩: ['패딩', '롱패딩', '숏패딩', '패딩점퍼', '다운자켓', '구스', '덕다운'],
}

const COLORS: Record<string, string[]> = {
  검정: ['검정', '검정색', '검은색', '검은', '까만', '까만색', '블랙'],
  회색: ['회색', '그레이', '쥐색', '멜란지'],
  흰색: ['흰색', '하얀색', '하얀', '흰', '화이트'],
  베이지: ['베이지', '아이보리', '크림', '오트밀'],
  갈색: ['갈색', '브라운', '밤색', '카멜'],
  카키: ['카키', '올리브'],
  초록: ['초록', '초록색', '녹색', '그린', '연두'],
  네이비: ['네이비', '남색'],
  파랑: ['파랑', '파란색', '파란', '블루', '청색'],
  하늘색: ['하늘색', '스카이블루', '연청', '연하늘'],
  빨강: ['빨강', '빨간색', '빨간', '레드', '와인', '버건디'],
  분홍: ['분홍', '분홍색', '핑크'],
  주황: ['주황', '주황색', '오렌지'],
  노랑: ['노랑', '노란색', '노란', '옐로우', '머스타드'],
  보라: ['보라', '보라색', '퍼플', '라벤더'],
}

const PATTERNS: Record<string, string[]> = {
  체크: ['체크', '체크무늬', '격자', '깅엄', '타탄'],
  줄무늬: ['줄무늬', '스트라이프', '스트라이프무늬', '줄'],
  도트: ['도트', '물방울', '땡땡이', '점무늬'],
  프린트: ['프린트', '프린팅', '그래픽', '로고', '그림'],
  무지: ['무지', '솔리드'],
}

// 이름에 색이 들어 있는 옷: 색을 따로 말하지 않았을 때만 기본 색으로 쓴다
const TYPE_IMPLIED_COLOR: Record<string, string> = { 청바지: '파랑', 데님: '파랑' }

type Entry = { word: string; value: string }
const flatten = (m: Record<string, string[]>): Entry[] =>
  Object.entries(m)
    .flatMap(([value, words]) => words.map((word) => ({ word, value })))
    .sort((a, b) => b.word.length - a.word.length)

const TYPE_ENTRIES = flatten(TYPES)
const COLOR_ENTRIES = flatten(COLORS)
const PATTERN_ENTRIES = flatten(PATTERNS)

/** text 안에서 사전의 말을 찾아 첫 번째(가장 긴 말 우선)를 돌려주고, 찾은 부분은 지운 나머지 글도 돌려준다. */
function take(text: string, entries: Entry[]): { value: string | null; word: string | null; rest: string } {
  let best: { idx: number; e: Entry } | null = null
  for (const e of entries) {
    const idx = text.indexOf(e.word)
    if (idx < 0) continue
    if (!best || idx < best.idx || (idx === best.idx && e.word.length > best.e.word.length)) best = { idx, e }
  }
  if (!best) return { value: null, word: null, rest: text }
  return { value: best.e.value, word: best.e.word, rest: text.slice(0, best.idx) + ' ' + text.slice(best.idx + best.e.word.length) }
}

// 한 줄에 여러 벌이 있을 때 나누는 말. "와이드"처럼 단어 안의 '와'는 나누지 않도록 뒤에 공백이 있을 때만 나눈다.
const SPLIT = /\s*(?:[,\n+/·、]|(?<=\S)(?:이랑|랑|하고|와|과|및|그리고)\s+)\s*/

export function parseClothing(input: string): ParseResult {
  const parts = input
    .replace(/\s+/g, (m) => (m.includes('\n') ? '\n' : ' '))
    .split(SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
  const items: ParsedClothing[] = []
  const unknown: string[] = []
  for (const part of parts) {
    // 한 조각에 옷이 여러 벌일 수 있다("검정 반팔 흰 반팔티", 음성은 '이랑'을 자주 빼먹는다).
    // 옷 종류 말마다 한 벌로 보고, 그 앞(앞 옷 뒤부터)의 말에서 색·무늬를 찾는다.
    const found = findTypes(part)
    if (found.length === 0) {
      unknown.push(part)
      continue
    }
    found.forEach((t, i) => {
      const prefix = part.slice(i === 0 ? 0 : found[i - 1]!.end, t.start)
      // 색을 옷 뒤에 말한 경우("반팔 검정"): 마지막 옷만 뒤의 말도 본다
      const suffix = i === found.length - 1 ? part.slice(t.end) : ''
      const c = take(prefix, COLOR_ENTRIES).value ? take(prefix, COLOR_ENTRIES) : take(suffix, COLOR_ENTRIES)
      const p = take(prefix, PATTERN_ENTRIES).value ? take(prefix, PATTERN_ENTRIES) : take(suffix, PATTERN_ENTRIES)
      const implied = TYPE_IMPLIED_COLOR[t.word]
      const color = c.value ?? implied ?? '기타'
      items.push({ type: t.value, color, pattern: p.value ?? '무지', colorGuessed: c.value === null && !implied })
    })
  }
  return { items, unknown }
}

/** 조각 안의 옷 종류 말을 앞에서부터 모두 찾는다. 같은 자리에서는 긴 말이 먼저(반팔티 > 반팔 > 티), 찾은 말은 겹쳐 세지 않는다. */
function findTypes(text: string): { value: string; word: string; start: number; end: number }[] {
  const out: { value: string; word: string; start: number; end: number }[] = []
  let i = 0
  while (i < text.length) {
    const e = TYPE_ENTRIES.find((x) => text.startsWith(x.word, i))
    if (e) {
      const prev = out[out.length - 1]
      // 같은 종류의 말이 띄어쓰기만 두고 이어지면 한 벌의 이름이다("후드 집업"). 다른 종류면("셔츠 청바지") 두 벌
      if (prev && prev.value === e.value && text.slice(prev.end, i).trim() === '') out[out.length - 1] = { ...prev, end: i + e.word.length }
      else out.push({ value: e.value, word: e.word, start: i, end: i + e.word.length })
      i += e.word.length
    } else i++
  }
  return out
}

/** 화면에 보여줄 이름 (예: "검정 체크 맨투맨") */
export const clothingLabel = (c: Pick<ParsedClothing, 'type' | 'color' | 'pattern'>) =>
  `${c.color === '기타' ? '' : `${c.color} `}${c.pattern !== '무지' ? `${c.pattern} ` : ''}${c.type}`
