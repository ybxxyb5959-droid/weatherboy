import { prisma } from '../db.js'
import { logger } from '../utils/logger.js'

/** 이 기간 동안 한 번도 안 온 "빈" 게스트 계정을 지운다 */
export const GUEST_IDLE_DAYS = 30
const BATCH = 500

/**
 * 게스트 정리: 접속한 지 오래됐고(GUEST_IDLE_DAYS 일) 아무 데이터도 남기지 않은 게스트 계정만 지운다.
 * - 지우지 않는 것: 카카오 등으로 연결된 계정, 관리자, 직접 담은 옷·일정·체감 후기·캘린더·알림 구독·앱 후기·의견이 하나라도 있는 계정
 * - 온보딩 때 넣어 둔 예시 옷만 있는 계정은 "빈" 계정으로 본다
 * 게스트 버튼을 여러 번 눌러 만들어진 쓰이지 않는 계정이나, 둘러보기만 하고 떠난 계정이 쌓이는 것을 막는다.
 */
export async function guestCleanupJob(now = new Date(), idleDays = GUEST_IDLE_DAYS) {
  const cutoff = new Date(now.getTime() - idleDays * 86_400_000)
  const empty = await prisma.user.findMany({
    where: {
      AND: [
        { isAdmin: false },
        { identities: { some: { provider: 'GUEST' }, none: { provider: { not: 'GUEST' } } } },
        { OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null, createdAt: { lt: cutoff } }] },
        { clothes: { none: { isSample: false } } },
        { events: { none: {} } },
        { feedbacks: { none: {} } },
        { calendarConnections: { none: {} } },
        { pushSubscriptions: { none: {} } },
        { appReview: { is: null } },
        { supportMessages: { none: {} } },
      ],
    },
    select: { id: true },
    take: BATCH,
  })
  if (empty.length === 0) return { deleted: 0 }
  // 나머지 데이터(예시 옷, 추천 기록, 알림 기록)는 사용자 삭제와 함께 지워지고, AI 호출 기록은 익명으로 남는다(DB 규칙)
  const r = await prisma.user.deleteMany({ where: { id: { in: empty.map((u) => u.id) } } })
  logger.info({ deleted: r.count, idleDays }, 'guest cleanup')
  return { deleted: r.count }
}
