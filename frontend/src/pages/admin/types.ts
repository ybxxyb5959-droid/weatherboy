// ───── 서버 응답 타입 ─────
export interface Dashboard {
  users: { total: number; kakao: number; guest: number; active24h: number; active7d: number }
  daily: { d: string; c: number }[]
  funnel: { step: string; count: number }[]
  reviews: { total: number; average: number | null; unread: number }
  support: { total: number; unread: number }
}
export interface AiUsage {
  days: { date: string; photo: number; text: number; explain: number; other: number; total: number; failed: number }[]
  failureRate: number | null
  avgMs: { photo: number | null; text: number | null }
  topUsers: { code: string; photo: number; text: number; explain: number; total: number }[]
  global: { used: number; cap: number; open: boolean }
  limits: { photoDaily: number; photoNewUser: number; textDaily: number; textNewUser: number; explainDaily: number; newUserHours: number; hourly: number }
}
export interface ReviewRow {
  id: string
  rating: number
  message: string
  createdAt: string
  read: boolean
  code: string
  provider: 'KAKAO' | 'GUEST' | null
  activeDays: number
}
export interface SupportRow {
  id: string
  kind: 'BUG' | 'IDEA' | 'OTHER'
  message: string
  createdAt: string
  read: boolean
  code: string
  provider: 'KAKAO' | 'GUEST' | null
}
export interface Check {
  key: string
  label: string
  ok: boolean
  note: string
  optional?: boolean
}
export interface Health {
  checks: Check[]
  jobs: { job: string; lastOkAt: string | null; lastFailAt: string | null; ok24: number; fail24: number }[]
  collectErrors: { job: string; target: string | null; status: string; message: string | null; createdAt: string }[]
  push: {
    subscriptions: number
    usersWithPush: number
    users: number
    kinds: { kind: string; sent: number; failed: number; skipped: number }[]
    failures: { kind: string; message: string | null; createdAt: string }[]
    optOut: { morning: number; rain: number; coldReturn: number; dust: number; feedback: number; closet: number }
  }
  server: { uptimeSec: number; node: string; rssMb: number; dbMs: number }
}
export interface UserRow {
  code: string
  provider: 'KAKAO' | 'GUEST' | null
  createdAt: string
  lastSeenAt: string | null
  activeDays: number
  region: string | null
  onboardingDone: boolean
  plan: string
  clothes: number
  events: number
  feedbacks: number
  push: boolean
  reviewed: boolean
}
export interface Users {
  total: number
  shown: number
  users: UserRow[]
}
export interface Retention {
  eligible: number
  returned: number
  rate: number | null
}
export interface Insights {
  retention: { d1: Retention; d7: Retention }
  activeDays: { label: string; count: number }[]
  daily14: { d: string; users: number; recs: number }[]
  clothes: { types: { label: string; count: number }[]; colors: { label: string; count: number }[]; patterns: { label: string; count: number }[] }
  titles: { analyzed: number; rare: { key: string; name: string; count: number }[]; taste: { total: number; color: number; type: number; pattern: number }; none: number }
  feedback: { cold: number; ok: number; hot: number; followed: number; notFollowed: number; windowDays: number }
  events: { total: number; kinds: { label: string; count: number }[] }
}
