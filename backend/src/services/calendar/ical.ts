// iCal(.ics) 구독 주소에서 일정을 읽어오는 도구. 구글/애플/삼성 캘린더 모두 이 표준 형식을 내보낸다.
// 외부 주소를 서버가 직접 열기 때문에, 내부망 접근(SSRF)·과도한 크기·느린 응답을 모두 막는다.
import dns from 'node:dns/promises'
import net from 'node:net'
import { AppError, badRequest } from '../../utils/errors.js'
import { fromKst } from '../../utils/time.js'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

export interface IcalEvent {
  uid: string
  title: string
  startAt: Date
  endAt: Date
  location: string
}

// ───── 주소 검증 ─────
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
}

/** 사용자가 붙여넣은 주소를 https 주소로 정리한다. webcal:// 은 https:// 로 바꾼다. */
export function normalizeIcalUrl(raw: string): URL {
  let text = raw.trim()
  if (/^webcals?:\/\//i.test(text)) text = text.replace(/^webcals?:\/\//i, 'https://')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw badRequest('올바른 캘린더 주소가 아니에요. 복사한 주소를 그대로 붙여넣어주세요.')
  }
  if (url.protocol !== 'https:') throw badRequest('https:// 또는 webcal:// 로 시작하는 주소만 쓸 수 있어요.')
  if (url.username || url.password) throw badRequest('주소에 아이디/비밀번호가 들어 있으면 안 돼요.')
  return url
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => [])
  if (addrs.length === 0) throw badRequest('캘린더 주소를 찾을 수 없어요.')
  if (addrs.some((a) => isPrivateIp(a.address))) throw badRequest('이 주소는 사용할 수 없어요.')
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw badRequest('캘린더 파일이 너무 커요.')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function fetchIcal(start: URL, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = start
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicHost(url)
    let res: Response
    try {
      res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'text/calendar, */*' } })
    } catch {
      throw new AppError(502, 'CALENDAR_UNREACHABLE', '캘린더에 연결하지 못했어요. 주소를 다시 확인해주세요.')
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) break
      url = normalizeIcalUrl(new URL(loc, url).toString())
      continue
    }
    if (!res.ok) throw new AppError(502, 'CALENDAR_UNREACHABLE', `캘린더를 불러오지 못했어요. (${res.status})`)
    const body = await readLimited(res)
    if (!body.includes('BEGIN:VCALENDAR')) throw badRequest('캘린더 형식이 아니에요. iCal(.ics) 주소가 맞는지 확인해주세요.')
    return body
  }
  throw new AppError(502, 'CALENDAR_UNREACHABLE', '캘린더 주소가 너무 많이 이동해요.')
}

// ───── 파싱 ─────
const unescapeText = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()

/** 특정 시간대(TZID)의 현지 시각을 UTC 로 바꾼다. 모르는 시간대는 한국 시간으로 본다. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string | undefined): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  if (!tz || tz === 'Asia/Seoul') return new Date(guess - 9 * 3600_000)
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(guess))
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return new Date(guess - (asUtc - guess))
  } catch {
    return new Date(guess - 9 * 3600_000)
  }
}

interface Parsed {
  date: Date
  allDay: boolean
}

function parseDate(value: string, params: string): Parsed | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (m[4] === undefined) return { date: fromKst(`${m[1]}-${m[2]}-${m[3]}`, '00:00'), allDay: true }
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6])]
  if (m[7]) return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false }
  const tz = /TZID=([^;:]+)/i.exec(params)?.[1]?.replace(/^"|"$/g, '')
  return { date: zonedToUtc(y, mo, d, h, mi, s, tz), allDay: false }
}

type Props = Record<string, { value: string; params: string }>

/**
 * VEVENT 들을 읽는다. 취소된 일정은 건너뛴다.
 * 반복 일정(RRULE)은 펼치지 않고 원본 한 건만 가져온다.
 */
export function parseIcs(text: string): IcalEvent[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const out: IcalEvent[] = []
  let cur: Props | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const ev = toEvent(cur)
        if (ev) out.push(ev)
      }
      cur = null
      continue
    }
    if (!cur) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const head = line.slice(0, idx)
    const semi = head.indexOf(';')
    const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase()
    if (!(name in cur)) cur[name] = { value: line.slice(idx + 1), params: semi < 0 ? '' : head.slice(semi + 1) }
  }
  return out
}

function toEvent(p: Props): IcalEvent | null {
  if (p.STATUS?.value.toUpperCase() === 'CANCELLED') return null
  if (!p.DTSTART) return null
  const start = parseDate(p.DTSTART.value, p.DTSTART.params)
  if (!start) return null
  const end = p.DTEND ? parseDate(p.DTEND.value, p.DTEND.params) : null
  const startAt = start.date
  let endAt: Date
  if (start.allDay) {
    // 종일 일정의 DTEND 는 '다음 날 0시'(제외 경계)라서 하루 뒤로 밀려 있다
    endAt = end ? new Date(end.date.getTime() - 60_000) : new Date(startAt.getTime() + 24 * 3600_000 - 60_000)
  } else {
    endAt = end ? end.date : new Date(startAt.getTime() + 3600_000)
  }
  if (endAt.getTime() <= startAt.getTime()) endAt = new Date(startAt.getTime() + 3600_000)
  const title = unescapeText(p.SUMMARY?.value ?? '') || '(제목 없음)'
  const uid = (p.UID?.value ?? '').trim() || `${title}@${startAt.toISOString()}`
  return { uid, title: title.slice(0, 100), startAt, endAt, location: unescapeText(p.LOCATION?.value ?? '').slice(0, 100) }
}

/** 제목으로 일정 종류를 짐작한다. 여행/캠핑/등산/야외활동이 아니면 기타. */
export function guessKind(title: string): 'TRAVEL' | 'CAMPING' | 'HIKING' | 'OUTDOOR' | 'OTHER' {
  const t = title.toLowerCase()
  if (/캠핑|camp/.test(t)) return 'CAMPING'
  if (/등산|산행|트레킹|둘레길|hiking|trekking/.test(t)) return 'HIKING'
  if (/여행|trip|travel|항공|비행|호텔|flight/.test(t)) return 'TRAVEL'
  if (/소풍|피크닉|콘서트|페스티벌|축제|체육대회|운동회|야유회|마라톤|골프|낚시|캠프|공원|나들이|picnic|festival|concert/.test(t)) return 'OUTDOOR'
  return 'OTHER'
}
