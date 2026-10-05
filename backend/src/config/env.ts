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
  // 옷 사진 인식에만 쓸 모델(선택). 비우면 GEMINI_MODEL 을 쓴다. 사진 분류는 가벼운 모델이 바지를 상의로 착각하는 일이 있어 더 큰 모델로 바꿔 볼 수 있다(호출 단가는 올라간다).
  GEMINI_PHOTO_MODEL: z.string().default(''),
  // 호출 한 건의 출력 토큰 상한. 자동 설명은 이 값과 512 중 작은 값을 쓴다.
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).default(2048),
  // AI 하루 사용량 한도(최근 24시간 호출 수). 시간당 60회 한도와 별개로, 하루 총량을 막는다. 숫자는 호출 기록(aiCallLog)을 보고 조정한다.
  AI_PHOTO_DAILY: z.coerce.number().int().min(1).default(120),
  AI_TEXT_DAILY: z.coerce.number().int().min(1).default(150),
  // 가입 직후(AI_NEWUSER_HOURS 시간)에는 옷장을 처음 채우느라 더 쓰므로 넉넉하게 허용한다.
  AI_PHOTO_NEWUSER: z.coerce.number().int().min(1).default(300),
  AI_TEXT_NEWUSER: z.coerce.number().int().min(1).default(200),
  AI_NEWUSER_HOURS: z.coerce.number().min(0).default(24),
  // 추천 설명을 AI 로 만드는 횟수의 사용자당 하루(최근 24시간) 한도. 사진·말과 따로 센다. 넘으면 AI 를 부르지 않고 템플릿 문장을 쓴다. 임시값: 첫 주 호출 기록을 보고 조정한다.
  AI_EXPLAIN_DAILY: z.coerce.number().int().min(1).default(20),
  // 서버 전체(모든 사용자 합계) 하루 AI 호출 상한. 넘으면 AI 기능을 잠시 닫는다(직접 등록·칩은 계속 열려 있다). 비용 폭주 안전장치라 예산에 맞게 조정한다.
  AI_GLOBAL_DAILY: z.coerce.number().int().min(1).default(3000),
  LOG_LEVEL: z.string().default('info'),
  // 설정하면 이 폴더(예: ../frontend/dist)의 화면 파일을 서버가 직접 내준다. Nginx 없이 한 곳에서 화면+API 를 서비스할 때(개인/베타 배포용).
  SERVE_FRONTEND_DIR: z.string().default(''),
  // true 면 알림/수집 예약 작업(worker)을 이 서버 프로세스 안에서 같이 돌린다. 서버를 한 개만 둘 수 있는 무료 호스팅용. 별도 worker 가 있으면 켜지 말 것(알림이 두 번 갈 수 있다).
  RUN_JOBS_IN_API: bool,
  // 관리자 페이지(/admin) 로그인 비밀번호. 비워 두면 비밀번호 로그인은 꺼진다(users.isAdmin 계정으로는 계속 가능).
  ADMIN_PASSWORD: z.string().default(''),
  // 새 후기가 오면 디스코드로 알려 준다. 비워 두면 알림 없이 관리자 페이지에서만 본다.
  DISCORD_WEBHOOK_URL: z.string().default(''),
  // true 면 디스코드 알림에 후기·의견 본문도 보낸다. 기본 false: 별점·종류·짧은 사용자 번호만 보낸다(개인정보처리방침이 "본문은 보내지 않는다"고 안내한다. 켜려면 방침 문구도 같이 고칠 것).
  DISCORD_INCLUDE_MESSAGE: bool,
})

export const env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
