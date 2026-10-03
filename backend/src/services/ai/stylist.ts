// 일정 상세의 "코디 상담": 사용자가 "뭐 입어야 할지 모르겠어" 같은 말을 하면 어떤 분위기로 입을지 선택지를 묻고,
// 고른 분위기(OutfitStyle)로 옷장에서 코디를 뽑는다. AI 는 말투와 선택지만 만들고, 옷은 Rule Engine 이 고른다.
// AI 가 꺼져 있거나 실패해도 키워드 규칙으로 같은 흐름이 동작한다.
import { z } from 'zod'
import { OUTFIT_STYLES, styleLabel, type OutfitStyle } from '../../rules/outfitStyle.js'
import { AppError } from '../../utils/errors.js'
import { geminiJson } from './gemini.js'

export interface StyleOption {
  style: OutfitStyle
  label: string
}
export interface StylistTurn {
  reply: string
  /** 분위기가 정해졌으면 그 값(바로 코디를 뽑는다). 아니면 null 이고 options 로 되묻는다 */
  style: OutfitStyle | null
  options: StyleOption[]
}
export interface StylistContext {
  title: string
  kind: string
  place: string
  dateText: string
  /** 예: "최저 12° · 최고 21° · 비 소식 없음" (예보가 없으면 빈 문자열) */
  weatherText: string
}
export interface ChatTurn {
  role: 'user' | 'ai'
  text: string
}

const FORMAL_EVENT = /면접|발표|프레젠테이션|회의|미팅|결혼|상견례|예식|장례|조문|시험|출근|입사|인터뷰|오디션|졸업/
const OUTDOOR_KINDS = new Set(['여행', '캠핑', '등산', '야외활동'])

/** 사용자가 말로 분위기를 직접 정했는지 (정장/비즈니스 캐주얼/편하게 ...) */
export function detectStyle(text: string): OutfitStyle | null {
  if (/비즈니스|세미\s*정장|단정|깔끔|캐주얼\s*정장|스마트/.test(text)) return 'SMART'
  if (/정장|포멀|격식|풀\s*정장|수트|슈트/.test(text)) return 'FORMAL'
  if (/활동|운동|등산|걷기|편한\s*옷|트레킹/.test(text)) return 'COMFORT'
  if (/캐주얼|편하게|편안|꾸안꾸|평범/.test(text)) return 'CASUAL'
  return null
}

/** AI 없이 쓰는 기본 선택지: 일정 제목/종류에 맞춰 2~3개 */
export function defaultOptions(ctx: Pick<StylistContext, 'title' | 'kind'>): StyleOption[] {
  const pick = (...s: OutfitStyle[]): StyleOption[] => s.map((style) => ({ style, label: styleLabel[style] }))
  if (FORMAL_EVENT.test(ctx.title)) return pick('FORMAL', 'SMART')
  if (OUTDOOR_KINDS.has(ctx.kind)) return pick('COMFORT', 'CASUAL')
  return pick('SMART', 'CASUAL', 'FORMAL')
}

/** 대화의 첫 인사. AI 를 부르지 않고 바로 보여준다 */
export const fallbackReply = (ctx: Pick<StylistContext, 'title'>) => `"${ctx.title}" 일정이네요. 어떤 느낌으로 입고 싶으세요?`

const validate = z.object({
  reply: z.string().min(1).max(300),
  style: z.enum([...OUTFIT_STYLES, 'NONE']),
  options: z.array(z.object({ style: z.enum(OUTFIT_STYLES), label: z.string().min(1).max(40) })).max(4),
})

const schema = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    style: { type: 'STRING', enum: [...OUTFIT_STYLES, 'NONE'] },
    options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { style: { type: 'STRING', enum: [...OUTFIT_STYLES] }, label: { type: 'STRING' } }, required: ['style', 'label'] } },
  },
  required: ['reply', 'style', 'options'],
}

function buildPrompt(ctx: StylistContext, history: ChatTurn[], text: string): string {
  return [
    '너는 날씨 옷차림 앱의 코디 도우미다. 사용자의 일정에 어울리는 옷차림 "분위기"를 정하도록 돕는다. 한국어 존댓말, 친근하고 짧게(최대 2문장).',
    `일정: ${ctx.title} (${ctx.kind}) · ${ctx.dateText}${ctx.place ? ` · ${ctx.place}` : ''}`,
    ctx.weatherText ? `날씨: ${ctx.weatherText}` : '날씨: 아직 예보 없음',
    `분위기 값: ${OUTFIT_STYLES.map((s) => `${s}(${styleLabel[s]})`).join(', ')}`,
    '규칙:',
    '- 사용자가 입고 싶은 분위기를 분명히 말했으면 style 에 그 값을 넣고 options 는 빈 배열로 둔다.',
    '- 아직 모르면 style 은 NONE, options 에 이 일정에 어울리는 선택지를 2~3개 넣는다. label 은 일정에 맞게 구체적으로 쓴다 (예: 면접이면 "포멀한 정장", "자유복장이면 단정한 비즈니스 캐주얼").',
    '- 구체적인 옷 이름(예: 검정 셔츠)은 말하지 마라. 옷은 사용자의 옷장에서 앱이 고른다.',
    '- 날씨 숫자는 위에 적힌 것만 말하고 새로 지어내지 마라.',
    `대화: ${JSON.stringify(history.slice(-6))}`,
    `사용자 말: ${JSON.stringify(text)}`,
  ].join('\n')
}

/** 사용자가 쓴 말에 대한 답. 분위기를 알아듣지 못하면 선택지로 되묻는다. */
export async function stylistReply(ctx: StylistContext, history: ChatTurn[], text: string, fetchImpl?: typeof fetch): Promise<StylistTurn> {
  const direct = detectStyle(text)
  try {
    const r = await geminiJson({ prompt: buildPrompt(ctx, history, text), schema, validate, fetchImpl })
    const seen = new Set<OutfitStyle>()
    const options = r.options.filter((o) => !seen.has(o.style) && !!seen.add(o.style))
    const style = r.style === 'NONE' ? direct : r.style
    if (style) return { reply: r.reply, style, options: [] }
    return { reply: r.reply, style: null, options: options.length >= 2 ? options : defaultOptions(ctx) }
  } catch (e) {
    // AI 꺼짐/실패: 키워드로 알아듣거나 기본 선택지로 되묻는다
    if (!(e instanceof AppError)) throw e
    if (direct) return { reply: `${styleLabel[direct]} 스타일로 골라볼게요.`, style: direct, options: [] }
    return { reply: fallbackReply(ctx), style: null, options: defaultOptions(ctx) }
  }
}
