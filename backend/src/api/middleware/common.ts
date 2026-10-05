import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError, type ZodType } from 'zod'
import { env, isProd } from '../../config/env.js'
import { prisma } from '../../db.js'
import { AppError, badRequest, forbidden, unauthorized } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import { notifyServerError } from '../../services/review/notifyOwner.js'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    oauthState?: string
    /** 관리자 비밀번호로 로그인한 시각(ms). 12시간 동안만 유효 */
    adminAt?: number
    /** 로그인 쿠키 기간을 마지막으로 연장한 시각(ms). 12시간마다 한 번 30일로 다시 늘린다 */
    renewedAt?: number
  }
}

export type AuthedRequest = Request & { userId: string }

/** async 핸들러의 reject 를 에러 미들웨어로 전달 (Express 5 도 지원하지만 명시적으로 유지) */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) throw badRequest('입력값을 확인해주세요.')
  return r.data
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session?.userId) return next(unauthorized())
  ;(req as AuthedRequest).userId = req.session.userId
  next()
}

export const ADMIN_SESSION_MS = 12 * 3600_000

export const requireAdmin: RequestHandler = wrap(async (req, _res, next) => {
  // 관리자 비밀번호로 로그인한 세션
  const at = req.session?.adminAt
  if (at && Date.now() - at < ADMIN_SESSION_MS) return next()
  const id = req.session?.userId
  if (!id) throw unauthorized()
  const u = await prisma.user.findUnique({ where: { id }, select: { isAdmin: true } })
  if (!u?.isAdmin) throw forbidden()
  ;(req as AuthedRequest).userId = id
  next()
})

/** 상태 변경 요청은 허용된 Origin 에서만 (SameSite=Lax 보조 CSRF 방어) */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.headers.origin
  if (origin && origin !== env.FRONTEND_ORIGIN) return next(forbidden('허용되지 않은 요청이에요.'))
  next()
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', '찾을 수 없어요.'))

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: '입력값을 확인해주세요.' })
    return
  }
  const e = err as { type?: string; status?: number }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: '입력값을 확인해주세요.' })
    return
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: '보내는 내용이 너무 커요.' })
    return
  }
  logger.error({ err: err instanceof Error ? { name: err.name, message: err.message, stack: isProd ? undefined : err.stack } : String(err), path: req.path }, 'unhandled error')
  void notifyServerError({ method: req.method, path: req.path, name: err instanceof Error ? err.name : 'Error', code: (err as { code?: string })?.code })
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.' })
}
