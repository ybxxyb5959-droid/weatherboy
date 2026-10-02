import pino from 'pino'
import { env } from '../config/env.js'

// 쿠키/토큰/키가 로그에 남지 않도록 redact
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.access_token',
      '*.refresh_token',
      '*.client_secret',
      '*.serviceKey',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
})
