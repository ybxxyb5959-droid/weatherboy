import type { RequestHandler } from 'express'

/** 로그인 쿠키가 유지되는 기간 */
export const SESSION_MAX_AGE_MS = 30 * 24 * 3600_000
/** 마지막 연장으로부터 이만큼 지나면 쿠키 기간을 다시 30일로 늘린다 */
export const RENEW_AFTER_MS = 12 * 3600_000

/**
 * 쓰는 동안은 로그인이 풀리지 않게 한다(마지막으로 쓴 날부터 30일).
 * express-session 의 rolling 은 요청마다 저장소를 건드려서, 하루에 한두 번만 연장한다.
 * (연장하지 않으면 로그인한 지 30일째에 무조건 풀려, 게스트는 옷장·일정을 잃는다.)
 */
export const renewSession: RequestHandler = (req, _res, next) => {
  const s = req.session
  if (s?.userId && Date.now() - (s.renewedAt ?? 0) > RENEW_AFTER_MS) {
    s.renewedAt = Date.now()
    s.cookie.maxAge = SESSION_MAX_AGE_MS
  }
  next()
}
