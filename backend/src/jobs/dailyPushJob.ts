import type { User } from '@prisma/client'
import { ruleConfig } from '../config/ruleConfig.js'
import { prisma } from '../db.js'
import { compute, routineOf, todayWindow } from '../services/recommendationService.js'
import { sendToUser, type PushKind, type PushOutcome, type PushSender } from '../services/push/push.js'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { kstDate, kstStartOfDay, toKstParts } from '../utils/time.js'

// ───── 시간 도우미 (모두 한국 시간 기준) ─────
const DEFAULT_OUT = '08:00'
const DEFAULT_HOME = '18:00'
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const kstMinutes = (d: Date) => {
  const p = toKstParts(d)
  return p.hour * 60 + p.minute
}
const kstWeekday = (d: Date) => new Date(`${kstDate(d)}T00:00:00Z`).getUTCDay() // 0=일 ~ 6=토

/** 하루에 한 사람에게 보내는 알림(일정 알림 제외) 상한 — 알림이 많아 끄는 일을 막는다 */
export const DAILY_PUSH_CAP = 2
/** 후기 요청은 7일에 이 횟수까지만 */
export const FEEDBACK_PER_WEEK = 3
const JOB_KINDS: PushKind[] = ['MORNING', 'RAIN', 'COLD_RETURN', 'DUST', 'FEEDBACK', 'CLOSET']

/** 일요일 20:00~21:00 (옷장 리마인드) */
export const isClosetSlot = (now: Date) => kstWeekday(now) === 0 && kstMinutes(now) >= 20 * 60 && kstMinutes(now) < 21 * 60

export interface DayPlan {
  active: boolean // 오늘이 외출하는 요일인가
  outMin: number
  homeMin: number
  morning: boolean // 지금이 아침 알림을 보낼 때인가
  returnFeedback: boolean // 지금이 후기 요청을 보낼 때인가
  outing: boolean // 지금이 외출 시간대(비 알림 대상)인가
}

/**
 * 오늘 하루 패턴과 지금 시각으로, 어떤 알림을 보낼 때인지 정한다.
 * - 아침: 외출 시각의 morningLeadMin 분 전부터 외출 15분 뒤까지 (15분마다 도는 작업이 놓치지 않게 여유를 둔다)
 * - 후기 요청: 귀가 30분 뒤부터 3시간 동안
 * - 비 알림: 외출 1시간 전부터 귀가 때까지
 * 외출/귀가 시간을 모르면 08:00 / 18:00 으로 본다.
 */
export function planFor(u: Pick<User, 'routineOutAt' | 'routineHomeAt' | 'routineDays' | 'morningLeadMin'>, now: Date): DayPlan {
  const outMin = minutesOf(u.routineOutAt ?? DEFAULT_OUT)
  const homeMin = minutesOf(u.routineHomeAt ?? DEFAULT_HOME)
  const t = kstMinutes(now)
  const active = u.routineDays.includes(kstWeekday(now))
  return {
    active,
    outMin,
    homeMin,
    morning: active && t >= outMin - u.morningLeadMin && t < outMin + 15,
    returnFeedback: active && t >= homeMin + 30 && t < homeMin + 30 + 180,
    outing: active && t >= outMin - 60 && t < homeMin,
  }
}

// ───── 알림 문구 ─────
export const morningBody = (items: string[], headline: string, notes: string[]) => [`${items.join(' + ')} · ${headline}`, ...notes].join('\n')
export const coldReturnNote = (outTemp: number, homeTemp: number) => `귀가할 땐 ${homeTemp}°로 나갈 때(${outTemp}°)보다 많이 쌀쌀해요. 겉옷 챙기세요.`
export const DUST_NOTE = '미세먼지가 나빠요. 마스크도 챙기세요.'
/** 귀가 때 기온이 나갈 때보다 이만큼(℃) 이상 낮으면 알린다 */
export const COLD_RETURN_DROP = 6

type Sent = Partial<Record<PushKind, number>>

/**
 * 15분마다 도는 알림 작업. 사용자마다 "지금 보낼 알림이 있는지" 정해서 보낸다.
 * 같은 알림은 하루에 한 번만(dedupeKey), 야간/전송 실패는 기록하지 않아 다음 실행에서 다시 시도한다.
 *  - MORNING     아침 오늘의 옷차림 (귀가 추위/미세먼지 한마디를 같이 붙인다)
 *  - COLD_RETURN / DUST  아침 알림을 끈 사람에게만 따로
 *  - RAIN        외출 중 곧 비가 올 때
 *  - FEEDBACK    귀가 후 후기 요청 (오늘 추천을 봤고 아직 후기를 안 남긴 경우만)
 *  - CLOSET      일요일 저녁, 옷장이 비어 있을 때
 */
export async function dailyPushJob(now = new Date(), sender?: PushSender) {
  const users = await prisma.user.findMany({ where: { onboardingDone: true, pushSubscriptions: { some: {} } }, take: 5000 })
  const sent: Sent = {}
  let errors = 0
  const count = (kind: PushKind, outcome: PushOutcome | null) => {
    if (outcome === 'SENT') sent[kind] = (sent[kind] ?? 0) + 1
  }
  for (const user of users) {
    try {
      await processUser(user, now, sender, count)
    } catch (e) {
      if (e instanceof AppError && e.code === 'LOCATION_UNRESOLVED') continue // 위치 미설정은 정상 상태
      errors++
      logger.warn({ userId: user.id, err: e instanceof Error ? e.message : String(e) }, 'daily push failed')
    }
  }
  return { users: users.length, sent, errors }
}

async function processUser(user: User, now: Date, sender: PushSender | undefined, count: (k: PushKind, o: PushOutcome | null) => void) {
  const plan = planFor(user, now)
  const day = kstDate(now)
  const send = async (kind: PushKind, key: string, title: string, body: string, url: string) => {
    // 하루 상한과 후기 주간 상한을 넘기지 않는다(구독이 여러 개여도 dedupeKey 가 있는 기록은 알림당 한 건)
    const sentToday = await prisma.notifyLog.count({ where: { userId: user.id, status: 'SENT', dedupeKey: { not: null }, kind: { in: JOB_KINDS }, createdAt: { gte: kstStartOfDay(now) } } })
    if (sentToday >= DAILY_PUSH_CAP) return null
    if (kind === 'FEEDBACK') {
      const week = await prisma.notifyLog.count({ where: { userId: user.id, status: 'SENT', dedupeKey: { not: null }, kind: 'FEEDBACK', createdAt: { gte: new Date(now.getTime() - 7 * 86400_000) } } })
      if (week >= FEEDBACK_PER_WEEK) return null
    }
    const o = await sendToUser(user.id, null, { title, body, url, tag: key.split(':')[0]!.toLowerCase() }, { now, sender, kind, dedupeKey: `${key}:${day}` })
    count(kind, o)
    return o
  }

  // 날씨가 필요한 알림(아침/비)
  const wantsMorning = plan.morning && (user.notifyMorning || user.notifyColdReturn || user.notifyDust)
  const wantsRain = user.notifyRain && plan.outing
  const wantsWeather = wantsMorning || wantsRain
  if (wantsWeather) {
    const w = todayWindow(now, routineOf(user))
    const c = await compute(user, null, w.start, w.end, now)
    if (c) {
      const pts = c.window.points
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      const notes: string[] = []
      const cold = last.feels <= first.feels - COLD_RETURN_DROP ? coldReturnNote(Math.round(first.feels), Math.round(last.feels)) : null
      const dust = c.result.needMask ? DUST_NOTE : null

      if (wantsMorning) {
        if (user.notifyMorning) {
          if (cold && user.notifyColdReturn) notes.push(cold)
          if (dust && user.notifyDust) notes.push(dust)
          await send('MORNING', 'MORNING', '오늘의 옷차림', morningBody(c.result.items.map((i) => i.label), c.result.headline, notes), '/home')
        } else {
          if (cold && user.notifyColdReturn) await send('COLD_RETURN', 'COLD_RETURN', '저녁엔 쌀쌀해져요', cold, '/home')
          if (dust && user.notifyDust) await send('DUST', 'DUST', '미세먼지 나쁨', DUST_NOTE, '/home')
        }
      }

      // 비: 지금부터 2시간 안에 우산이 필요한 예보가 있으면
      if (wantsRain) {
        const soon = pts.find((p) => p.at.getTime() >= now.getTime() - 3600_000 && p.at.getTime() <= now.getTime() + 2 * 3600_000 && (p.pop >= ruleConfig.umbrellaPopThreshold || p.precip !== 'none'))
        if (soon) await send('RAIN', 'RAIN', '우산 챙기세요', `${toKstParts(soon.at).hour}시쯤 비 소식이 있어요. 우산 챙기세요.`, '/home')
      }
    }
  }

  // 귀가 후 후기 요청: 오늘 추천을 봤고(저장된 추천이 있고) 아직 후기를 안 남겼을 때만
  if (user.notifyFeedback && plan.returnFeedback) {
    const rec = await prisma.recommendation.findFirst({ where: { userId: user.id, eventId: null, targetStartAt: kstStartOfDay(now) }, orderBy: { version: 'desc' }, select: { id: true } })
    if (rec && !(await prisma.feedback.findFirst({ where: { userId: user.id, recommendation: { targetStartAt: kstStartOfDay(now), eventId: null } }, select: { id: true } }))) {
      await send('FEEDBACK', 'FEEDBACK', '오늘 어땠나요?', '입은 옷이 어땠는지 알려주세요. 다음 추천이 더 정확해져요.', '/home?fb=now')
    }
  }

  // 옷장 리마인드: 일요일 저녁, 직접 담은 옷이 5벌 미만이면
  if (user.notifyCloset && isClosetSlot(now)) {
    const n = await prisma.clothing.count({ where: { userId: user.id, active: true, isSample: false } })
    if (n < 5) await send('CLOSET', 'CLOSET', '옷장을 채워볼까요?', `옷장에 옷이 ${n}벌뿐이에요. 더 담으면 추천이 다양해져요.`, '/wardrobe/add')
  }
}
