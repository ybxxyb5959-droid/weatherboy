// 관리자 "시스템 점검": 환경설정이 제대로 되어 있는지 켜짐/꺼짐으로만 알려준다. 값 자체(키, 비밀번호)는 절대 돌려주지 않는다.
export interface Check {
  key: string
  label: string
  ok: boolean
  /** 문제가 있을 때 무엇을 하면 되는지(없으면 짧은 설명) */
  note: string
  /** 선택 항목: 꺼져 있어도 문제가 아니라서 "확인 필요" 로 세지 않는다 */
  optional?: boolean
}

export interface EnvLike {
  NODE_ENV: string
  KAKAO_REST_API_KEY: string
  KAKAO_LOCAL_REST_API_KEY: string
  KAKAO_CLIENT_SECRET: string
  KAKAO_REDIRECT_URI: string
  KMA_SERVICE_KEY: string
  AIRKOREA_SERVICE_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  AI_ENABLED: boolean
  GEMINI_API_KEY: string
  GEMINI_MODEL: string
  RUN_JOBS_IN_API: boolean
  ADMIN_PASSWORD: string
  DISCORD_WEBHOOK_URL: string
}

/** VAPID_SUBJECT 는 mailto: 이메일 또는 https:// 주소여야 한다(이메일만 쓰면 알림 발송이 막힌다) */
export function vapidSubjectProblem(subject: string): string | null {
  if (!subject) return 'VAPID_SUBJECT 가 비어 있어요'
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(subject) || /^https:\/\/\S+$/.test(subject)) return null
  return 'VAPID_SUBJECT 는 "mailto:내이메일" 또는 "https://주소" 형식이어야 해요'
}

export function buildChecks(env: EnvLike, opts: { dbOk: boolean; dbMs: number | null; lastCollectAt: Date | null; now?: Date }): Check[] {
  const now = opts.now ?? new Date()
  const vapidKeys = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
  const subjectProblem = vapidSubjectProblem(env.VAPID_SUBJECT)
  const collectAgoH = opts.lastCollectAt ? (now.getTime() - opts.lastCollectAt.getTime()) / 3_600_000 : null
  const jobsOk = collectAgoH !== null && collectAgoH <= 6
  return [
    { key: 'db', label: '데이터베이스', ok: opts.dbOk, note: opts.dbOk ? `응답 ${opts.dbMs ?? '?'}ms` : 'DB 에 연결하지 못했어요' },
    { key: 'kma', label: '날씨(기상청) 키', ok: !!env.KMA_SERVICE_KEY, note: env.KMA_SERVICE_KEY ? '설정됨' : 'KMA_SERVICE_KEY 가 없어요(날씨를 못 받아요)' },
    { key: 'air', label: '미세먼지(에어코리아) 키', ok: !!env.AIRKOREA_SERVICE_KEY, note: env.AIRKOREA_SERVICE_KEY ? '설정됨' : 'AIRKOREA_SERVICE_KEY 가 없어요(미세먼지를 못 받아요)' },
    {
      key: 'kakao-login',
      label: '카카오 로그인',
      ok: !!(env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET && env.KAKAO_REDIRECT_URI),
      note: env.KAKAO_REST_API_KEY && env.KAKAO_CLIENT_SECRET && env.KAKAO_REDIRECT_URI ? '설정됨' : 'REST 키·클라이언트 시크릿·리다이렉트 주소 중 비어 있는 게 있어요',
    },
    { key: 'kakao-local', label: '카카오 지역 검색', ok: !!(env.KAKAO_LOCAL_REST_API_KEY || env.KAKAO_REST_API_KEY), note: env.KAKAO_LOCAL_REST_API_KEY || env.KAKAO_REST_API_KEY ? '설정됨' : '지역 검색 키가 없어요' },
    {
      key: 'push',
      label: '휴대폰 알림(VAPID)',
      ok: vapidKeys && !subjectProblem,
      note: !vapidKeys ? 'VAPID 공개키/비공개키가 없어요' : (subjectProblem ?? '설정됨'),
    },
    {
      key: 'ai',
      label: 'AI(Gemini)',
      ok: env.AI_ENABLED && !!env.GEMINI_API_KEY && !!env.GEMINI_MODEL,
      note: !env.AI_ENABLED ? 'AI_ENABLED 가 꺼져 있어요(사진·말 인식은 직접 입력으로 대체돼요)' : !env.GEMINI_API_KEY ? 'GEMINI_API_KEY 가 없어요' : !env.GEMINI_MODEL ? 'GEMINI_MODEL 이 없어요' : '켜짐',
    },
    {
      key: 'jobs',
      label: '예약 작업(날씨 수집·알림)',
      ok: jobsOk,
      note: collectAgoH === null ? '수집 기록이 아직 없어요. 서버가 쉬고 있으면 작업이 안 돌아요' : jobsOk ? `최근 수집 ${collectAgoH < 1 ? '1시간 안' : `${Math.round(collectAgoH)}시간 전`}` : `마지막 수집이 ${Math.round(collectAgoH)}시간 전이에요. 서버가 잠들었거나 작업이 멈춘 것 같아요${env.RUN_JOBS_IN_API ? '' : '(RUN_JOBS_IN_API 가 꺼져 있어요)'}`,
    },
    { key: 'admin', label: '관리자 비밀번호', ok: !!env.ADMIN_PASSWORD, note: env.ADMIN_PASSWORD ? '설정됨' : 'ADMIN_PASSWORD 가 없어요(관리자 계정으로만 들어올 수 있어요)' },
    { key: 'discord', label: '후기 디스코드 알림(선택)', ok: !!env.DISCORD_WEBHOOK_URL, note: env.DISCORD_WEBHOOK_URL ? '설정됨' : '꺼짐(선택 사항)', optional: true },
    { key: 'prod', label: '운영 모드', ok: env.NODE_ENV === 'production', note: env.NODE_ENV === 'production' ? 'production' : `NODE_ENV=${env.NODE_ENV}`, optional: true },
  ]
}
