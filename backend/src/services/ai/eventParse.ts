// "다음주 금요일부터 2박 3일 제주 여행" 같은 말을 일정 입력 칸(종류/날짜/장소/시간)으로 바꾼다.
// 결과는 제안일 뿐이고 사용자가 확인한 뒤 저장한다. 날짜는 서버가 다시 검증한다.
import { z } from 'zod'
import { eventKindMap } from '../../config/mappings.js'
import { AppError } from '../../utils/errors.js'
import { kstDate } from '../../utils/time.js'
import { geminiJson } from './gemini.js'

const kinds = eventKindMap.uiValues
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const blank = z.literal('')

const validate = z.object({
  understood: z.boolean(),
  title: z.string().max(100),
  kind: z.enum(kinds),
  startDate: z.union([ymd, blank]),
  endDate: z.union([ymd, blank]),
  place: z.string().max(100),
  startTime: z.union([hhmm, blank]),
  endTime: z.union([hhmm, blank]),
})

const schema = {
  type: 'OBJECT',
  properties: {
    understood: { type: 'BOOLEAN' },
    title: { type: 'STRING' },
    kind: { type: 'STRING', enum: [...kinds] },
    startDate: { type: 'STRING' },
    endDate: { type: 'STRING' },
    place: { type: 'STRING' },
    startTime: { type: 'STRING' },
    endTime: { type: 'STRING' },
  },
  required: ['understood', 'title', 'kind', 'startDate', 'endDate', 'place', 'startTime', 'endTime'],
}

function buildPrompt(text: string, now: Date): string {
  const today = kstDate(now)
  const wd = WEEKDAY[new Date(`${today}T00:00:00Z`).getUTCDay()]
  return [
    `오늘은 ${today}(${wd}요일, 한국 시간)이다. 사용자가 적은 일정 문장을 읽고 JSON 으로 답해라.`,
    '- understood: 일정으로 이해했으면 true, 날짜나 일정 내용을 전혀 알 수 없으면 false',
    '- title: 짧은 제목 (예: 제주 여행)',
    `- kind: 다음 중 하나: ${kinds.join(', ')} (여행/캠핑/등산/야외활동에 해당하지 않으면 기타)`,
    '- startDate / endDate: YYYY-MM-DD. "N박 M일"이면 endDate = startDate + N일. 하루짜리면 endDate 는 빈 문자열.',
    '  "다음주 금요일" 같은 말은 오늘 날짜를 기준으로 계산한다.',
    '- place: 장소 (없으면 빈 문자열)',
    '- startTime / endTime: HH:mm 24시간. 말하지 않았으면 빈 문자열.',
    '문장에 없는 정보는 지어내지 말고 빈 문자열로 둬라.',
    `문장: ${JSON.stringify(text)}`,
  ].join('\n')
}

export interface EventSuggestion {
  title: string
  kind: (typeof kinds)[number]
  startDate: string
  endDate?: string
  place: string
  startTime?: string
  endTime?: string
}

export async function parseEventText(text: string, now = new Date(), fetchImpl?: typeof fetch): Promise<EventSuggestion> {
  const r = await geminiJson({ prompt: buildPrompt(text, now), schema, validate, fetchImpl })
  const limit = kstDate(new Date(now.getTime() + 2 * 365 * 86400_000))
  // AI 가 날짜를 못 잡았거나(빈 값) 말도 안 되는 날짜를 만들면 제안하지 않는다
  if (!r.understood || !r.startDate || r.startDate < kstDate(new Date(now.getTime() - 86400_000)) || r.startDate > limit) {
    throw new AppError(422, 'EVENT_NOT_UNDERSTOOD', '날짜를 알아듣지 못했어요. "다음주 금요일 제주 여행"처럼 날짜를 함께 적어주세요.')
  }
  return {
    title: r.title.trim() || '새 일정',
    kind: r.kind,
    startDate: r.startDate,
    ...(r.endDate && r.endDate > r.startDate ? { endDate: r.endDate } : {}),
    place: r.place.trim(),
    ...(r.startTime ? { startTime: r.startTime } : {}),
    ...(r.endTime ? { endTime: r.endTime } : {}),
  }
}
