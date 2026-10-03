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
  // 설정하면 이 폴더(예: ../frontend/dist)의 화면 파일을 서버가 직접 내준다. Nginx 없이 한 곳에서 화면+API 를 서비스할 때(개인/베타 배포용).
  SERVE_FRONTEND_DIR: z.string().default(''),
  // true 면 알림/수집 예약 작업(worker)을 이 서버 프로세스 안에서 같이 돌린다. 서버를 한 개만 둘 수 있는 무료 호스팅용. 별도 worker 가 있으면 켜지 말 것(알림이 두 번 갈 수 있다).
  RUN_JOBS_IN_API: bool,
  // 관리자 페이지(/admin) 로그인 비밀번호. 비워 두면 비밀번호 로그인은 꺼진다(users.isAdmin 계정으로는 계속 가능).
  ADMIN_PASSWORD: z.string().default(''),
  // 새 후기가 오면 디스코드로 알려 준다. 비워 두면 알림 없이 관리자 페이지에서만 본다.
  DISCORD_WEBHOOK_URL: z.string().default(''),
})

export const env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
