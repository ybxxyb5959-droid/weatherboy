// AI 호출 기록(aiCallLog) 쓰기: gemini.ts(사진·말)와 explain.ts(자동 설명)가 같이 쓴다.
import type { Prisma } from '@prisma/client'
import { prisma } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { currentAiScope } from './aiScope.js'
import { resetGlobalCache, stopAiOnLogFailure } from './aiQuota.js'

/**
 * 호출 기록을 남긴다. 기록 실패 뒤에는 비용을 확인할 수 없으므로 후속 AI 호출을 닫는다.
 * 호출이 도는 사이에 사용자가 탈퇴했다면 userId FK 에 걸려 쓰기가 거절된다 → 사용자 정보 없이 다시 쓴다
 * (탈퇴한 사용자를 가리키는 기록은 남기지 않되, 서버 전체 상한과 관리자 집계에는 호출 한 건으로 남는다).
 */
export async function recordAiCall(data: Omit<Prisma.AiCallLogUncheckedCreateInput, 'userId' | 'kind'>, reservationId?: string): Promise<void> {
  const scope = currentAiScope()
  try {
    if (reservationId) {
      // userId 는 예약 시 설정했다. 탈퇴로 SET NULL 이 된 값은 되돌리지 않는다.
      await prisma.aiCallLog.update({ where: { id: reservationId }, data })
      resetGlobalCache()
      return
    }
    await prisma.aiCallLog.create({ data: { ...data, message: data.message?.slice(0, 300), userId: scope?.userId, kind: scope?.kind } })
    resetGlobalCache()
  } catch (e) {
    if ((e as { code?: string }).code === 'P2003' && scope) {
      try {
        await prisma.aiCallLog.create({ data: { ...data, message: data.message?.slice(0, 300), kind: scope.kind } })
        resetGlobalCache()
        return
      } catch (e2) {
        logger.warn({ err: String(e2) }, 'ai log write failed')
        stopAiOnLogFailure()
        return
      }
    }
    logger.warn({ err: String(e) }, 'ai log write failed')
    stopAiOnLogFailure()
  }
}
