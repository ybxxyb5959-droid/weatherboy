// 옷 사진 -> 종류/색/무늬. 결과는 "입력 칸을 채우는 제안"일 뿐이고, 사용자가 확인해야 저장된다.
// 두께·방풍·방수는 사진으로 정확히 알 수 없고 호출량만 늘어서 AI 에게 묻지 않는다 (사용자가 직접 입력하거나 기본값).
import { z } from 'zod'
import { clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'
import { AppError } from '../../utils/errors.js'
import { env } from '../../config/env.js'
import { geminiJson, type GeminiImage } from './gemini.js'

// 사진 인식 전용 모델(없으면 기본 모델)
const photoModel = () => env.GEMINI_PHOTO_MODEL || undefined

const types = clothingTypeMap.uiValues
const colors = colorMap.uiValues
const patterns = patternMap.uiValues

export interface ClothingSuggestion {
  type: (typeof types)[number]
  color: (typeof colors)[number]
  pattern: (typeof patterns)[number]
}

const typeLine = `- type: 다음 중 가장 가까운 것 하나: ${types.join(', ')}`
const colorLine = `- color: 옷에서 가장 넓은 바탕색을 다음 중 하나로: ${colors.join(', ')} (체크·줄무늬 옷은 바탕에서 가장 큰 색. 목록에 없는 색일 때만 기타)`
const patternLine = '- pattern: 무지(무늬 없음), 체크(격자), 줄무늬(스트라이프), 도트(물방울), 프린트(큰 그림·글자·로고) 중 하나'

// ───── 옷 한 벌 ─────
const validate = z.object({ isClothing: z.boolean(), type: z.enum(types), color: z.enum(colors), pattern: z.enum(patterns) })

const schema = {
  type: 'OBJECT',
  properties: {
    isClothing: { type: 'BOOLEAN' },
    type: { type: 'STRING', enum: [...types] },
    color: { type: 'STRING', enum: [...colors] },
    pattern: { type: 'STRING', enum: [...patterns] },
  },
  required: ['isClothing', 'type', 'color', 'pattern'],
}

const prompt = [
  '사진 속 옷 한 벌을 보고 아래 항목을 JSON 으로 답해라.',
  '사진에 옷이 여러 벌 보이면 가장 크게 보이는 겉쪽 옷 한 벌만 기준으로 한다 (예: 셔츠를 걸치고 안에 티셔츠가 보이면 셔츠).',
  '- isClothing: 사진이 옷(상의/하의/겉옷)이면 true, 아니면 false',
  '- 바지·치마 같은 하의도 옷이다. 접히거나 걸려 있어도 허리밴드, 길게 이어진 다리통, 발목·밑단이 보이면 하의로 본다.',
  typeLine,
  colorLine,
  patternLine,
  '사진에 없는 정보를 지어내지 마라. 옷이 아니면 type, color, pattern 은 아무 값이나 채워라.',
].join('\n')

export async function clothingFromPhoto(image: GeminiImage, fetchImpl?: typeof fetch): Promise<ClothingSuggestion> {
  const r = await geminiJson({ prompt, image, schema, validate, fetchImpl, model: photoModel() })
  if (!r.isClothing) throw new AppError(422, 'NOT_CLOTHING', '옷이 아닌 것 같아요. 옷 한 벌이 잘 보이게 다시 찍어주세요.')
  return { type: r.type, color: r.color, pattern: r.pattern }
}

// ───── 옷장/행거 사진 한 장에서 여러 벌 ─────
const MAX_ITEMS = 12

/** 종류를 얼마나 확신하는지: 헷갈림이면 화면에서 체크를 기본으로 풀고 "확인해 주세요"를 붙인다 */
export const CONFIDENCES = ['확실', '보통', '헷갈림'] as const
export type Confidence = (typeof CONFIDENCES)[number]

/** 사진에 어떤 옷만 있는지 사용자가 알려 준 범위. 알려 주면 종류 선택지를 그 범위로 좁혀 상의·하의를 서로 헷갈리지 않는다. */
export const PHOTO_PARTS = ['all', 'top', 'bottom'] as const
export type PhotoPart = (typeof PHOTO_PARTS)[number]
const BOTTOM_TYPES = ['바지', '반바지', '치마']
const typesFor = (part: PhotoPart): string[] => (part === 'bottom' ? types.filter((t) => BOTTOM_TYPES.includes(t)) : part === 'top' ? types.filter((t) => !BOTTOM_TYPES.includes(t)) : [...types])

const multiValidate = z.object({
  items: z
    .array(
      z.object({
        label: z.string().max(30),
        type: z.enum(types),
        color: z.enum(colors),
        pattern: z.enum(patterns),
        // 근거 한 줄은 모델이 종류를 한 번 더 따져 보게 하려고 받는다(화면에는 쓰지 않는다). 빠져도 실패로 보지 않는다.
        evidence: z.string().max(40).optional().catch(undefined),
        confidence: z.enum(CONFIDENCES).catch('보통'),
      }),
    )
    .max(30),
})

const multiSchema = (part: PhotoPart) => ({
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          type: { type: 'STRING', enum: typesFor(part) },
          color: { type: 'STRING', enum: [...colors] },
          pattern: { type: 'STRING', enum: [...patterns] },
          evidence: { type: 'STRING' },
          confidence: { type: 'STRING', enum: [...CONFIDENCES] },
        },
        required: ['label', 'type', 'color', 'pattern', 'evidence', 'confidence'],
      },
    },
  },
  required: ['items'],
})

// 같은 사진으로 지시문을 비교한 결과(가벼운 모델): 예전 지시문은 행거에 걸린 바지를 바람막이·긴팔·셔츠로 보는 일이 잦았고,
// 아래처럼 "먼저 상의/하의/겉옷을 정하고, 구분 단서를 쓰고, 근거를 한 줄 적게" 했더니 바지를 바지로 보았다.
const multiPromptLines = [
  '옷장이나 행거 사진이다. 사진에 보이는 옷(상의/하의/겉옷)을 한 벌씩 따로 찾아 JSON 의 items 배열로 답해라.',
  `- 최대 ${MAX_ITEMS}벌. 앞에 크게 보이는 옷부터 순서대로.`,
  '- 같은 옷을 두 번 넣지 말고, 종류와 색을 알아볼 수 없을 만큼 가려지거나 흐린 옷은 넣지 마라. 옷이 아닌 물건(옷걸이, 선반, 가방 등)은 넣지 마라.',
  '- 먼저 그 옷이 몸의 어느 부분을 덮는 옷인지(상의/하의/겉옷) 정한 뒤, 그 안에서 종류를 골라라. 구분 단서:',
  '  · 행거에 걸린 하의는 접힌 채 허리 쪽만 걸리고 다리통이 아래로 길게 늘어진다. 허리밴드·벨트고리·끈(드로스트링)·길게 이어진 다리통, 발목 쪽 고무밴드(조거)나 밑단이 보이면 바지다.',
  '  · 청(데님) 질감, 주머니, 굵은 박음질이 보이면 청바지(바지)다. 연한 색 청바지를 하늘색 셔츠로 착각하지 마라.',
  '  · 후드티·맨투맨·셔츠는 목둘레(모자, 리브 칼라, 단추 칼라)와 어깨선, 소매가 보인다. 목둘레와 어깨가 안 보이고 길게 늘어진 천이면 상의가 아니라 바지일 가능성이 높다.',
  '  · 고무밴드가 보여도 목둘레나 어깨와 이어져 있으면 소매, 허리 쪽과 이어져 있으면 바지 밑단이다. 둘을 헷갈리지 마라.',
  '- evidence: 그 종류라고 본 눈에 보이는 단서를 12자 이내 한국어로 (예: 허리끈, 발목 밴드, 모자, 단추 칼라, 데님 주머니)',
  '- confidence: 종류를 확신하면 확실, 단서가 부족하면 보통, 상의인지 하의인지부터 헷갈리면 헷갈림',
  '- label: 어떤 옷인지 알아보기 쉬운 짧은 한국어 이름 (예: 체크 셔츠, 검정 플리스 폴로, 하늘색 셔츠)',
  typeLine,
  colorLine,
  patternLine,
  '옷이 하나도 안 보이면 items 를 빈 배열로 답하고, 사진에 없는 옷을 지어내지 마라.',
]

const partHint: Record<PhotoPart, string | null> = {
  all: null,
  top: '이 사진에 있는 옷은 전부 상의 또는 겉옷이다. 바지·치마 같은 하의는 사진에 없으니 하의로 답하지 마라.',
  bottom: '이 사진에 있는 옷은 전부 하의(바지·반바지·치마)다. 상의나 겉옷은 없다. 후드·바람막이·셔츠처럼 보여도(스웨트·나일론·청 소재, 연한 색 포함) 하의로 본다.',
}
const promptFor = (part: PhotoPart): string => {
  const lines = multiPromptLines.map((l) => (l === typeLine ? `- type: 다음 중 가장 가까운 것 하나: ${typesFor(part).join(', ')}` : l))
  const hint = partHint[part]
  return (hint ? [lines[0]!, hint, ...lines.slice(1)] : lines).join('\n')
}

export interface ClothesSuggestion extends ClothingSuggestion {
  label: string
  confidence: Confidence
}

export async function clothesFromPhoto(image: GeminiImage, fetchImpl?: typeof fetch, part: PhotoPart = 'all'): Promise<ClothesSuggestion[]> {
  const r = await geminiJson({ prompt: promptFor(part), image, schema: multiSchema(part), validate: multiValidate, fetchImpl, model: photoModel() })
  if (r.items.length === 0) throw new AppError(422, 'NOT_CLOTHING', '사진에서 옷을 찾지 못했어요. 옷이 잘 보이게 다시 찍어주세요.')
  // 근거(evidence)는 모델이 따져 보게 하려는 용도라서 화면에는 보내지 않는다
  return r.items.slice(0, MAX_ITEMS).map(({ evidence: _evidence, ...item }) => item)
}
