// 옷 사진 -> 종류/색/무늬. 결과는 "입력 칸을 채우는 제안"일 뿐이고, 사용자가 확인해야 저장된다.
// 두께·방풍·방수는 사진으로 정확히 알 수 없고 호출량만 늘어서 AI 에게 묻지 않는다 (사용자가 직접 입력하거나 기본값).
import { z } from 'zod'
import { clothingTypeMap, colorMap, patternMap } from '../../config/mappings.js'
import { AppError } from '../../utils/errors.js'
import { geminiJson, type GeminiImage } from './gemini.js'

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
  typeLine,
  colorLine,
  patternLine,
  '사진에 없는 정보를 지어내지 마라. 옷이 아니면 type, color, pattern 은 아무 값이나 채워라.',
].join('\n')

export async function clothingFromPhoto(image: GeminiImage, fetchImpl?: typeof fetch): Promise<ClothingSuggestion> {
  const r = await geminiJson({ prompt, image, schema, validate, fetchImpl })
  if (!r.isClothing) throw new AppError(422, 'NOT_CLOTHING', '옷이 아닌 것 같아요. 옷 한 벌이 잘 보이게 다시 찍어주세요.')
  return { type: r.type, color: r.color, pattern: r.pattern }
}

// ───── 옷장/행거 사진 한 장에서 여러 벌 ─────
const MAX_ITEMS = 12

const multiValidate = z.object({
  items: z.array(z.object({ label: z.string().max(30), type: z.enum(types), color: z.enum(colors), pattern: z.enum(patterns) })).max(30),
})

const multiSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          type: { type: 'STRING', enum: [...types] },
          color: { type: 'STRING', enum: [...colors] },
          pattern: { type: 'STRING', enum: [...patterns] },
        },
        required: ['label', 'type', 'color', 'pattern'],
      },
    },
  },
  required: ['items'],
}

const multiPrompt = [
  '옷장이나 행거 사진이다. 사진에 보이는 옷(상의/하의/겉옷)을 한 벌씩 따로 찾아 JSON 의 items 배열로 답해라.',
  `- 최대 ${MAX_ITEMS}벌. 앞에 크게 보이는 옷부터 순서대로.`,
  '- 같은 옷을 두 번 넣지 말고, 종류와 색을 알아볼 수 없을 만큼 가려지거나 흐린 옷은 넣지 마라. 옷이 아닌 물건(옷걸이, 선반, 가방 등)은 넣지 마라.',
  '- label: 어떤 옷인지 알아보기 쉬운 짧은 한국어 이름 (예: 체크 셔츠, 검정 플리스 폴로, 하늘색 셔츠)',
  typeLine,
  colorLine,
  patternLine,
  '옷이 하나도 안 보이면 items 를 빈 배열로 답하고, 사진에 없는 옷을 지어내지 마라.',
].join('\n')

export interface ClothesSuggestion extends ClothingSuggestion {
  label: string
}

export async function clothesFromPhoto(image: GeminiImage, fetchImpl?: typeof fetch): Promise<ClothesSuggestion[]> {
  const r = await geminiJson({ prompt: multiPrompt, image, schema: multiSchema, validate: multiValidate, fetchImpl })
  if (r.items.length === 0) throw new AppError(422, 'NOT_CLOTHING', '사진에서 옷을 찾지 못했어요. 옷이 잘 보이게 다시 찍어주세요.')
  return r.items.slice(0, MAX_ITEMS)
}
