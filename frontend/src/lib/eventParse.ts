// "다음주 금요일부터 2박 3일 제주 여행", "토요일 저녁 7시 강남역에서 엄마 생일" 같은 말을 일정 칸으로 바꾼다.
// AI 없이 규칙과 키워드 사전으로만 해석한다(빠르고, 오프라인에서도 되고, 같은 말이면 결과가 항상 같다).
// 날짜를 못 찾을 때만 화면에서 AI(제미나이)에게 한 번 더 물어본다.
import type { EventKind } from '../mocks/events'

export interface EventDraft {
  /** 문장에서 찾은 종류. 키워드가 없으면 '기타' (kindFound=false) */
  kind: EventKind
  kindFound: boolean
  title: string
  /** YYYY-MM-DD (한국 날짜). 못 찾으면 null */
  startDate: string | null
  /** 며칠짜리면 마지막 날 */
  endDate: string | null
  /** 몇 박인지 (당일치기는 0). 말하지 않았으면 null */
  nights: number | null
  place: string
  /** HH:mm. 말하지 않았으면 null */
  startTime: string | null
  endTime: string | null
}

// ───── 날짜 계산 (UTC 자정 기준 '날 번호'로 다뤄서 시간대 문제를 피한다) ─────
const dayNo = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / 86400_000
}
const ymdOf = (n: number) => new Date(n * 86400_000).toISOString().slice(0, 10)
const addDays = (ymd: string, n: number) => ymdOf(dayNo(ymd) + n)
const dowOf = (ymd: string) => new Date(dayNo(ymd) * 86400_000).getUTCDay() // 0=일
const validYmd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? ymdOf(t.getTime() / 86400_000) : null
}

const WEEK = '월화수목금토일' // 월요일=0 (한 주는 월요일부터)
const KNUM: Record<string, number> = { 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 한: 1, 두: 2, 세: 3, 네: 4 }
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : (KNUM[s] ?? NaN))

// ───── 일정 종류 키워드 (위에 있는 종류가 먼저) ─────
const KINDS: [EventKind, string[]][] = [
  ['캠핑', ['오토캠핑', '글램핑', '캠핑', '차박', '백패킹', '캠프']],
  ['등산', ['등산', '산행', '트레킹', '트래킹', '둘레길', '등반', '올레길']],
  ['여행', ['여행', '휴가', '투어', '호캉스', '해외', '놀러', '배낭', '워케이션', '신혼여행', '여름휴가']],
  ['야외활동', ['피크닉', '소풍', '나들이', '한강', '공원', '축제', '페스티벌', '야외', '운동회', '낚시', '꽃구경', '단풍', '벚꽃', '산책', '자전거', '라이딩', '골프', '바다', '해수욕', '물놀이', '야구장', '축구장', '경기장', '수목원', '동물원', '놀이공원', '테마파크', '불꽃놀이']],
]
// '○○산' 이 산 이름인지: 산으로 끝나는 도시 이름은 뺀다
const MOUNTAIN = /([가-힣]{1,4}산)(?=[에으로을를\s]|$)/
const NOT_MOUNTAIN = new Set(['부산', '울산', '마산', '군산', '익산', '오산', '경산', '양산', '서산', '안산', '논산', '산본', '광산', '청산', '용산', '아산', '일산', '화산', '출산', '예산', '재산', '계산', '생산'])

// 장소가 아닌 말(날짜·시간·일정 말)
const NOT_PLACE = /^(부터|까지|동안|쯤|경|오늘|내일|모레|글피|이번|다음|다다음|담주|주말|평일|아침|점심|저녁|밤|새벽|오전|오후|낮|[월화수목금토일](요일|욜)?|\d+.*|가족|친구|회사|팀|엄마|아빠|동생|언니|오빠|누나|형)$/

/** 문장 -> 일정 칸. today 는 한국 날짜 YYYY-MM-DD */
export function parseEventText(input: string, today: string): EventDraft {
  let text = ` ${input.replace(/\s+/g, ' ').trim()} `
  // 찾은 부분은 제목을 만들 때 빼려고 지운다
  const cut = (m: RegExpMatchArray | null) => {
    if (m && m.index != null) text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
  }

  // ── 몇 박 며칠 ──
  let nights: number | null = null
  const stay = text.match(/(\d|[일이삼사오육칠])\s*박\s*(?:(\d|[이삼사오육칠팔])\s*일)?/)
  if (stay) {
    nights = num(stay[1]!)
    cut(stay)
  } else if (/당일\s*치기|당일/.test(text)) {
    nights = 0
    cut(text.match(/당일\s*치기|당일/))
  } else {
    const days = text.match(/(\d|하루|이틀|사흘|나흘)\s*(?:일\s*)?(?:간|동안)/)
    if (days) {
      nights = Math.max(0, num(days[1]!) - 1)
      cut(days)
    }
  }

  // ── 날짜 ──
  const y0 = Number(today.slice(0, 4))
  const m0 = Number(today.slice(5, 7))
  // 연도를 안 말했으면 올해, 이미 지났으면 내년
  const pickYear = (m: number, d: number, y?: number) => {
    if (y) return validYmd(y, m, d)
    const cand = validYmd(y0, m, d)
    return cand && cand < today ? validYmd(y0 + 1, m, d) : cand
  }
  let start: string | null = null
  let end: string | null = null

  const abs = text.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? text.match(/(?<![\d:])()(\d{1,2})\s*\/\s*(\d{1,2})(?![\d:])/)
  if (abs) {
    start = pickYear(Number(abs[2]), Number(abs[3]), abs[1] ? Number(abs[1]) : undefined)
    cut(abs)
    // "~ 5일까지", "부터 10월 5일까지"
    const tail = text.slice(abs.index ?? 0).match(/^\s*(?:부터)?\s*(?:~|-|에서)?\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일\s*(?:까지)?/)
    if (start && tail && (tail[0].includes('~') || tail[0].includes('-') || tail[0].includes('까지') || tail[0].includes('부터'))) {
      const em = tail[1] ? Number(tail[1]) : Number(start.slice(5, 7))
      const e = validYmd(Number(start.slice(0, 4)), em, Number(tail[2]))
      if (e) end = e < start ? validYmd(Number(start.slice(0, 4)) + 1, em, Number(tail[2])) : e
      text = text.slice(0, abs.index ?? 0) + ' ' + text.slice((abs.index ?? 0) + tail[0].length)
    }
  }

  if (!start) {
    const mon = text.match(/(이번\s*달|다음\s*달|담달|다다음\s*달)\s*(\d{1,2})\s*일/)
    if (mon) {
      const plus = /다다음/.test(mon[1]!) ? 2 : /다음|담달/.test(mon[1]!) ? 1 : 0
      const mm = ((m0 - 1 + plus) % 12) + 1
      const yy = y0 + Math.floor((m0 - 1 + plus) / 12)
      start = validYmd(yy, mm, Number(mon[2]))
      cut(mon)
    }
  }

  if (!start) {
    const rel = text.match(/일주일\s*(?:뒤|후)|(하루|이틀|사흘|나흘)\s*(?:뒤|후)|(\d+|한|두|세)\s*(일|주)\s*(?:뒤|후)/)
    if (rel) {
      start = rel[0].startsWith('일주일') ? addDays(today, 7) : rel[1] ? addDays(today, num(rel[1])) : addDays(today, num(rel[2]!) * (rel[3] === '주' ? 7 : 1))
      cut(rel)
    }
  }

  if (!start) {
    const word = text.match(/내일\s*모레|오늘|내일|모레|글피/)
    if (word) {
      const w = word[0].replace(/\s/g, '')
      start = addDays(today, w === '오늘' ? 0 : w === '내일' ? 1 : w === '글피' ? 3 : 2)
      cut(word)
    }
  }

  const monday = addDays(today, -((dowOf(today) + 6) % 7))
  const weekOf = (prefix: string | undefined) => (!prefix ? null : /다다음/.test(prefix) ? 14 : /다음|담주|오는/.test(prefix) ? 7 : 0)
  if (!start) {
    const wd = text.match(/(이번\s*주|다음\s*주|담주|다다음\s*주|오는)?\s*([월화수목금토일])(?:요일|욜)/)
    if (wd) {
      const idx = WEEK.indexOf(wd[2]!)
      const plus = weekOf(wd[1])
      if (plus === null) {
        // 그냥 "금요일": 오늘이거나 다가오는 금요일
        const diff = (idx - ((dowOf(today) + 6) % 7) + 7) % 7
        start = addDays(today, diff)
      } else {
        start = addDays(monday, plus + idx)
        if (start < today) start = addDays(start, 7)
      }
      // "금요일부터 일요일까지": 바로 뒤에 이어지는 요일이 끝나는 날
      const from = (wd.index ?? 0) + wd[0].length
      const to = text.slice(from).match(/^\s*(?:부터)?\s*(?:~|-)?\s*([월화수목금토일])(?:요일|욜)\s*(?:까지)?/)
      if (to && start) {
        const eIdx = WEEK.indexOf(to[1]!)
        const sIdx = (dowOf(start) + 6) % 7
        end = addDays(start, (eIdx - sIdx + 7) % 7)
        text = text.slice(0, from) + ' ' + text.slice(from + to[0].length)
      }
      cut(wd)
    } else {
      const wk = text.match(/(이번|다음|담|다다음)?\s*주말/)
      if (wk) {
        const plus = weekOf(wk[1] ? `${wk[1]}주` : undefined) ?? 0
        start = addDays(monday, plus + 5) // 토요일
        if (start < today) start = addDays(start, 7)
        cut(wk)
      }
    }
  }

  if (!start) {
    // "15일에", "3일부터": 이번 달(지났으면 다음 달)
    const d = text.match(/(?<![\d월박])(\d{1,2})\s*일(?=\s*(?:부터|에|날|~|-|까지|\s|$))/)
    if (d) {
      const n = Number(d[1])
      const thisMonth = validYmd(y0, m0, n)
      start = thisMonth && thisMonth >= today ? thisMonth : validYmd(m0 === 12 ? y0 + 1 : y0, (m0 % 12) + 1, n)
      cut(d)
    }
  }

  // 며칠짜리: 끝나는 날을 말했으면 그걸로 몇 박인지, 몇 박을 말했으면 끝나는 날을 계산
  if (start && end && end > start) nights = dayNo(end) - dayNo(start)
  else if (start && nights && nights > 0) end = addDays(start, nights)
  else end = null

  // 날짜를 뺀 뒤에 홀로 남은 "부터/까지" 같은 말은 장소·제목으로 새지 않게 지운다 ("10월 31일 부터 1박 2일 캠핑")
  text = text.replace(/(^|\s)(부터|까지|~|-|쯤|경)(?=\s|$)/g, ' ')

  // ── 시간 ──
  const times: number[] = [] // 하루 중 분
  const timeRe = /(오전|오후|아침|낮|점심|저녁|밤|새벽)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?|(\d{1,2}):(\d{2})/g
  for (const m of text.matchAll(timeRe)) {
    let h = Number(m[2] ?? m[5])
    const min = m[6] ? Number(m[6]) : m[3] === '반' ? 30 : m[4] ? Number(m[4]) : 0
    const part = m[1]
    if (h > 24 || min > 59) continue
    if ((part === '오후' || part === '저녁' || part === '밤') && h < 12) h += 12
    else if ((part === '낮' || part === '점심') && h < 6) h += 12
    else if ((part === '오전' || part === '아침' || part === '새벽') && h === 12) h = 0
    else if (!part && !m[5] && h >= 1 && h <= 7) h += 12 // 그냥 "3시"는 보통 오후 3시
    // "오후 3시부터 6시까지"의 6시는 앞의 오후를 따른다
    else if (!part && !m[5] && times.length > 0 && times[0]! >= 12 * 60 && h < 12) h += 12
    times.push((h % 24) * 60 + min)
    if (times.length >= 2) break
  }
  for (const m of [...text.matchAll(timeRe)].slice(0, 2).reverse()) cut(m)
  // 숫자 없이 "저녁 약속", "점심" 처럼만 말하면 그 때쯤으로
  if (times.length === 0) {
    const part = text.match(/아침|점심|저녁|오후|밤/)
    const at: Record<string, number> = { 아침: 8 * 60, 점심: 12 * 60, 오후: 14 * 60, 저녁: 18 * 60, 밤: 20 * 60 }
    if (part) times.push(at[part[0]]!)
  }
  const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  const startTime = times[0] != null ? hhmm(times[0]) : null
  const endTime = times[1] != null && times[1] > times[0]! ? hhmm(times[1]) : times[0] != null ? hhmm(Math.min(times[0] + 180, 23 * 60 + 30)) : null

  // ── 종류 ──
  const plain = input.replace(/\s+/g, '')
  let kind: EventKind = '기타'
  let kindWord = ''
  for (const [k, words] of KINDS) {
    const w = words.find((x) => plain.includes(x))
    if (w) {
      kind = k
      kindWord = w
      break
    }
  }
  const mountain = input.match(MOUNTAIN)
  const mountainName = mountain && !NOT_MOUNTAIN.has(mountain[1]!) ? mountain[1]! : ''
  if (kind === '기타' && mountainName) {
    kind = '등산'
    kindWord = '등산'
  }
  // 하룻밤 이상 묵는 일정은 여행으로 본다(캠핑은 그대로)
  if (nights && nights > 0 && kind !== '여행' && kind !== '캠핑') {
    kind = '여행'
    if (!kindWord) kindWord = '여행'
  }
  const kindFound = kind !== '기타'

  // ── 장소 ──
  const clean = (w: string) => w.replace(/(에서|으로|에|로|까지|을|를|은|는|이|가)$/, '')
  // 고른 종류 말 자체("여행")만 아니면 된다: "한강 피크닉"의 한강은 야외활동 말이지만 장소다
  const okPlace = (w: string) => w.length >= 1 && !NOT_PLACE.test(w) && w !== kindWord
  let place = ''
  const words = text.trim().split(' ').filter(Boolean)
  const at = words.findIndex((w) => /에서$/.test(w) && w.length > 2)
  if (at >= 0 && okPlace(clean(words[at]!))) {
    place = clean(words[at]!)
    text = text.replace(words[at]!, ' ') // "강남역에서"는 제목에 넣지 않는다
  }
  if (!place && kindWord) {
    // 종류 말 바로 앞의 말 ("제주 여행", "가평 캠핑")
    const i = words.findIndex((w) => w.includes(kindWord))
    const before = i > 0 ? clean(words[i - 1]!) : ''
    const glued = i >= 0 ? clean(words[i]!.replace(kindWord, '')) : '' // "제주여행"
    if (glued && okPlace(glued)) place = glued
    else if (before && okPlace(before)) place = before
  }
  if (!place && mountainName) place = mountainName
  if (!place) {
    const go = text.match(/([가-힣A-Za-z0-9]{2,12})(?:으로|로|에)\s*(?:가|놀러|떠나|간다|갈)/)
    if (go && okPlace(go[1]!)) place = go[1]!
  }

  // ── 제목 ──
  let title = ''
  // 남은 말: 날짜·시간을 뺀 나머지에서 홀로 남은 조사("에", "부터")와 말끝("있어", "가요")도 뺀다
  const rest = ` ${text} `
    .replace(/(부터|까지|~|-)/g, ' ')
    .replace(/\s+/g, '  ')
    .replace(/\s(에|에는|날|은|는|있어|있음|있어요|예정|가기|가요|간다|갈거야|하기|해요|할거야|가자)(?=\s)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 여행 등으로 알아들었는데 장소를 못 찾았고 남은 말이 한 단어뿐이면 그게 장소다 ("금요일부터 일요일까지 강릉")
  if (kindFound && !place && rest && !rest.includes(' ') && (!kindWord || !rest.includes(kindWord)) && okPlace(clean(rest))) place = clean(rest)
  if (kindWord && place) title = `${place} ${kindWord}`
  else {
    title = rest
    if (!title && kindWord) title = kindWord
    if (title.length > 30) title = title.slice(0, 30)
  }

  return { kind, kindFound, title, startDate: start, endDate: end, nights: start ? nights : null, place, startTime, endTime }
}
