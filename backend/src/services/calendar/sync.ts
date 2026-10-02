import type { CalendarConnection } from '@prisma/client'
import { prisma } from '../../db.js'
import { resolveLocation } from '../location.js'
import { fetchIcal, guessKind, normalizeIcalUrl, parseIcs } from './ical.js'

const PAST_DAYS = 1
const FUTURE_DAYS = 90
const MAX_EVENTS = 200
export const STALE_MS = 30 * 60 * 1000

async function placeData(place: string) {
  const empty = { placeName: place, latitude: null, longitude: null, gridNx: null, gridNy: null, regionSido: null, regionDistrict: null }
  if (!place) return empty
  try {
    const loc = await resolveLocation(place)
    if (!loc) return empty
    return { placeName: place, latitude: loc.latitude, longitude: loc.longitude, gridNx: loc.gridNx, gridNy: loc.gridNy, regionSido: loc.regionSido, regionDistrict: loc.regionDistrict }
  } catch {
    // 장소를 못 찾아도 일정 자체는 가져온다
    return empty
  }
}

/**
 * 연결된 캘린더를 읽어서 일정을 맞춘다 (새로 생기면 추가, 바뀌면 수정, 사라지면 삭제).
 * 지금부터 하루 전 ~ 90일 뒤까지만, 최대 200건.
 */
export async function syncConnection(conn: CalendarConnection, now = new Date()): Promise<{ imported: number }> {
  try {
    const text = await fetchIcal(normalizeIcalUrl(conn.icalUrl))
    const lo = now.getTime() - PAST_DAYS * 86400_000
    const hi = now.getTime() + FUTURE_DAYS * 86400_000
    const wanted = new Map<string, ReturnType<typeof parseIcs>[number]>()
    for (const e of parseIcs(text)) {
      if (e.endAt.getTime() < lo || e.startAt.getTime() > hi) continue
      if (wanted.size >= MAX_EVENTS) break
      wanted.set(e.uid, e)
    }

    const existing = await prisma.event.findMany({ where: { calendarConnectionId: conn.id } })
    const byUid = new Map(existing.map((e) => [e.externalUid, e]))

    for (const [uid, e] of wanted) {
      const cur = byUid.get(uid)
      if (!cur) {
        await prisma.event.create({
          data: {
            userId: conn.userId,
            calendarConnectionId: conn.id,
            externalUid: uid,
            title: e.title,
            kind: guessKind(e.title),
            startAt: e.startAt,
            endAt: e.endAt,
            ...(await placeData(e.location)),
          },
        })
        continue
      }
      const timeChanged = cur.startAt.getTime() !== e.startAt.getTime() || cur.endAt.getTime() !== e.endAt.getTime()
      const placeChanged = cur.placeName !== e.location
      if (cur.title !== e.title || timeChanged || placeChanged) {
        await prisma.event.update({
          where: { id: cur.id },
          data: { title: e.title, startAt: e.startAt, endAt: e.endAt, ...(placeChanged ? await placeData(e.location) : {}), ...(timeChanged ? { forecastStage: 'WAITING' as const, recommendationVersion: 0, lastDecisionKey: null } : {}) },
        })
      }
    }
    const gone = existing.filter((e) => e.externalUid && !wanted.has(e.externalUid)).map((e) => e.id)
    if (gone.length > 0) await prisma.event.deleteMany({ where: { id: { in: gone } } })

    await prisma.calendarConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: now, lastError: null } })
    return { imported: wanted.size }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await prisma.calendarConnection.update({ where: { id: conn.id }, data: { lastError: message.slice(0, 200) } }).catch(() => undefined)
    throw e
  }
}

/** 오래된 연결만 뒤에서 조용히 다시 읽는다. 실패해도 일정 화면은 그대로 보여준다. */
export function syncStaleInBackground(userId: string, now = new Date()): void {
  void (async () => {
    const conns = await prisma.calendarConnection.findMany({ where: { userId } })
    for (const c of conns) {
      if (c.lastSyncedAt && now.getTime() - c.lastSyncedAt.getTime() < STALE_MS) continue
      await syncConnection(c, now).catch(() => undefined)
    }
  })().catch(() => undefined)
}
