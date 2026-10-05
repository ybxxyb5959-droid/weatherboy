import { analyze, TITLES, MIN_CLOTHES, type ClothesForAnalysis } from '../character/analysis.js'

export interface TitleDistribution {
  /** 옷이 MIN_CLOTHES 벌 이상이라 칭호를 분석한 사용자 수 */
  analyzed: number
  rare: { key: string; name: string; count: number }[]
  taste: { total: number; color: number; type: number; pattern: number }
  /** 희귀 칭호도 취향 칭호도 없는 사용자(특징이 정말 없는 옷장) */
  none: number
}

/** 사용자별 옷장으로 칭호 분포를 센다. 희귀 칭호는 주칭호만 센다. */
export function titleDistribution(closets: Iterable<ClothesForAnalysis[]>): TitleDistribution {
  const counts = new Map<string, number>()
  const taste = { total: 0, color: 0, type: 0, pattern: 0 }
  let analyzed = 0
  let none = 0
  for (const clothes of closets) {
    if (clothes.length < MIN_CLOTHES) continue
    analyzed++
    const a = analyze(clothes)
    if (a.title) counts.set(a.title.key, (counts.get(a.title.key) ?? 0) + 1)
    else if (a.taste) {
      taste.total++
      if (a.taste.name.endsWith('편애 중')) taste.color++
      else if (a.taste.name.endsWith('단골')) taste.type++
      else taste.pattern++
    } else none++
  }
  const rare = TITLES.map((t) => ({ key: t.key, name: t.name, count: counts.get(t.key) ?? 0 })).sort((a, b) => b.count - a.count)
  return { analyzed, rare, taste, none }
}

export interface Retention {
  /** 가입한 지 N일이 지난 사용자 */
  eligible: number
  /** 그중 가입 N일 뒤 이후에 다시 접속한 사용자(마지막 접속 기준의 근사값) */
  returned: number
  rate: number | null
}

/**
 * 재방문율(근사): 접속 기록이 "마지막 접속 시각" 하나뿐이라 정확한 D1/D7 은 알 수 없다.
 * 가입 후 N일이 지난 사용자 중, 마지막 접속이 가입 후 N일 이상 뒤인 사람의 비율로 본다.
 */
export function retentionOf(rows: { createdAt: Date; lastSeenAt: Date | null }[], days: number, now = new Date()): Retention {
  const ms = days * 86_400_000
  let eligible = 0
  let returned = 0
  for (const r of rows) {
    if (now.getTime() - r.createdAt.getTime() < ms) continue
    eligible++
    if (r.lastSeenAt && r.lastSeenAt.getTime() - r.createdAt.getTime() >= ms) returned++
  }
  return { eligible, returned, rate: eligible === 0 ? null : Math.round((1000 * returned) / eligible) / 10 }
}

/** 접속일수 분포: 1일 / 2일 / 3~6일 / 7일 이상 */
export function activeDaysBuckets(days: number[]) {
  const b = { '1일': 0, '2일': 0, '3~6일': 0, '7일 이상': 0 }
  for (const d of days) {
    if (d <= 1) b['1일']++
    else if (d === 2) b['2일']++
    else if (d <= 6) b['3~6일']++
    else b['7일 이상']++
  }
  return Object.entries(b).map(([label, count]) => ({ label, count }))
}
