import 'dotenv/config'
import { z } from 'zod'

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16),
  KAKAO_REST_API_KEY: z.string().default(''),
  // Kakao Local 전용 키(선택). 비어 있으면 KAKAO_REST_API_KEY 를 사용한다.
  KAKAO_LOCAL_REST_API_KEY: z.string().default(''),
  KAKAO_CLIENT_SECRET: z.string().default(''),
  KAKAO_REDIRECT_URI: z.string().default(''),
  KMA_SERVICE_KEY: z.string().default(''),
  AIRKOREA_SERVICE_KEY: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default(''),
  AI_ENABLED: bool,
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
  LOG_LEVEL: z.string().default('info'),
})

export const env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
