import type { Event, User } from '@prisma/client'
import { notifyConfig } from '../config/ruleConfig.js'
import { prisma } from '../db.js'
import { sendToUser, type PushOutcome, type PushSender } from '../services/push/push.js'

export type NotifyDecision = 'FIRST' | 'CHANGE' | 'RECORD_ONLY' | 'NONE'

/**
 * 숫자가 조금 변한 것만으로는 Push 하지 않는다. 추천 판단(decisionKey)이 바뀐 경우만.
 *  - lastDecisionKey 가 없음  -> 최초 옷차림 생성 (notifyEvent)
 *  - lastDecisionKey != 현재  -> 판단 변경 (notifyChange)
 *  - 알림 꺼짐/횟수 초과 -> 보내지 않고 기록만(RECORD_ONLY)
 */
export function decideNotification(i: {
  lastDecisionKey: string | null
  currentKey: string
  notificationCount: number
  notifyEvent: boolean
  notifyChange: boolean
}): NotifyDecision {
  if (i.lastDecisionKey === i.currentKey) return 'NONE'
  const kind = i.lastDecisionKey == null ? 'FIRST' : 'CHANGE'
  const enabled = kind === 'FIRST' ? i.notifyEvent : i.notifyChange
  if (!enabled || i.notificationCount >= notifyConfig.maxPerEvent) return 'RECORD_ONLY'
  return kind
}

export function messageFor(kind: 'FIRST' | 'CHANGE', title: string) {
  return kind === 'FIRST'
    ? { title: '옷차림이 생성되었어요', body: `${title} 옷차림이 생성되었어요! 확인하러 갈까요?` }
    : { title: '예보가 바뀌었어요', body: `${title} 예보가 바뀌어 옷차림이 달라졌어요.` }
}

/** 판단 변경에 따른 Push 처리. 야간(QUIET)/전송 실패는 lastDecisionKey 를 갱신하지 않아 다음 실행에서 재시도한다. */
export async function pushNotificationJob(
  user: Pick<User, 'id' | 'notifyEvent' | 'notifyChange'>,
  event: Pick<Event, 'id' | 'title' | 'lastDecisionKey' | 'notificationCount'>,
  currentKey: string,
  opts: { now?: Date; sender?: PushSender } = {},
): Promise<{ decision: NotifyDecision; outcome: PushOutcome | null }> {
  const decision = decideNotification({
    lastDecisionKey: event.lastDecisionKey,
    currentKey,
    notificationCount: event.notificationCount,
    notifyEvent: user.notifyEvent,
    notifyChange: user.notifyChange,
  })
  if (decision === 'NONE') return { decision, outcome: null }
  if (decision === 'RECORD_ONLY') {
    await prisma.event.update({ where: { id: event.id }, data: { lastDecisionKey: currentKey } })
    return { decision, outcome: null }
  }
  const m = messageFor(decision, event.title)
  const outcome = await sendToUser(user.id, event.id, { ...m, url: `/events/${event.id}`, tag: `event-${event.id}` }, { ...opts, kind: decision === 'FIRST' ? 'EVENT_FIRST' : 'EVENT_CHANGE' })
  if (outcome === 'SENT') {
    await prisma.event.update({ where: { id: event.id }, data: { lastDecisionKey: currentKey, notificationCount: { increment: 1 } } })
  } else if (outcome === 'NO_SUBSCRIPTION' || outcome === 'NOT_CONFIGURED') {
    await prisma.event.update({ where: { id: event.id }, data: { lastDecisionKey: currentKey } })
  }
  return { decision, outcome }
}
