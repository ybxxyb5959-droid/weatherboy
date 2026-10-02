import { prisma } from '../db.js'
import { ensureShortTerm, getAirQuality } from '../services/weather/weatherService.js'
import { logger } from '../utils/logger.js'

/** 사용자 위치와 곧 있을 일정이 쓰는 격자의 단기예보를 미리 수집 (격자당 1회, 사용자별 중복 수집 없음) */
export async function weatherCollectionJob(now = new Date()) {
  const users = await prisma.user.findMany({ where: { onboardingDone: true, gridNx: { not: null }, gridNy: { not: null } }, select: { gridNx: true, gridNy: true }, distinct: ['gridNx', 'gridNy'] })
  const events = await prisma.event.findMany({ where: { endAt: { gt: now }, startAt: { lt: new Date(now.getTime() + 4 * 86400_000) }, gridNx: { not: null } }, select: { gridNx: true, gridNy: true }, distinct: ['gridNx', 'gridNy'] })
  const grids = new Map<string, { nx: number; ny: number }>()
  for (const g of [...users, ...events]) if (g.gridNx != null && g.gridNy != null) grids.set(`${g.gridNx},${g.gridNy}`, { nx: g.gridNx, ny: g.gridNy })
  let ok = 0
  for (const g of grids.values()) {
    try {
      await ensureShortTerm(g.nx, g.ny, now)
      ok++
    } catch (e) {
      logger.warn({ grid: `${g.nx},${g.ny}`, err: e instanceof Error ? e.message : String(e) }, 'weather collection failed')
    }
  }
  return { grids: grids.size, ok }
}

export async function airQualityCollectionJob(now = new Date()) {
  const users = await prisma.user.findMany({ where: { onboardingDone: true, regionSido: { not: null } }, select: { gridNx: true, gridNy: true, regionSido: true, regionDistrict: true }, distinct: ['regionSido', 'regionDistrict'] })
  let ok = 0
  for (const u of users) {
    const r = await getAirQuality({ nx: u.gridNx ?? 0, ny: u.gridNy ?? 0, sido: u.regionSido, district: u.regionDistrict }, now)
    if (r) ok++
  }
  return { regions: users.length, ok }
}
