import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db.js', () => ({ prisma: { aiCallLog: { create: vi.fn().mockResolvedValue({}) } } }))

import { env } from '../../src/config/env.js'
import { clothesFromPhoto, clothingFromPhoto } from '../../src/services/ai/clothingVision.js'
import { parseEventText } from '../../src/services/ai/eventParse.js'

// Gemini 응답 모양을 흉내 내는 가짜 fetch
const gemini = (obj: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) })) as unknown as typeof fetch

const photo = { mimeType: 'image/jpeg', base64: 'AAAA' }
const NOW = new Date('2026-10-02T03:00:00Z') // 2026-10-02(금) 12:00 KST

let saved: { AI_ENABLED: boolean; GEMINI_API_KEY: string; GEMINI_MODEL: string }
beforeEach(() => {
  saved = { AI_ENABLED: env.AI_ENABLED, GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL }
  Object.assign(env, { AI_ENABLED: true, GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' })
})
afterEach(() => Object.assign(env, saved))

describe('사진으로 옷 등록', () => {
  it('AI 가 준 값을 우리 선택지로 돌려준다', async () => {
    const f = gemini({ isClothing: true, type: '후드티', color: '회색', pattern: '무지' })
    expect(await clothingFromPhoto(photo, f)).toEqual({ type: '후드티', color: '회색', pattern: '무지' })
    // 사진이 이미지 파트로 전달되고, JSON 응답을 요구한다
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { body: string }).body)
    expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'AAAA' })
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })

  it('옷이 아니면 422', async () => {
    const f = gemini({ isClothing: false, type: '니트', color: '기타', pattern: '무지' })
    await expect(clothingFromPhoto(photo, f)).rejects.toMatchObject({ status: 422, code: 'NOT_CLOTHING' })
  })

  it('목록에 없는 값을 만들어내면 AI 실패로 처리한다', async () => {
    const f = gemini({ isClothing: true, type: '우주복', color: '회색', pattern: '무지' })
    await expect(clothingFromPhoto(photo, f)).rejects.toMatchObject({ status: 502, code: 'AI_FAILED' })
  })

  it('AI 서버가 오류를 주면 502', async () => {
    await expect(clothingFromPhoto(photo, gemini({}, false))).rejects.toMatchObject({ status: 502, code: 'AI_FAILED' })
  })

  it('AI 가 꺼져 있으면 503', async () => {
    Object.assign(env, { AI_ENABLED: false })
    await expect(clothingFromPhoto(photo, gemini({}))).rejects.toMatchObject({ status: 503, code: 'AI_DISABLED' })
  })
})

describe('말로 일정 등록', () => {
  const ok = { understood: true, title: '제주 여행', kind: '여행', startDate: '2026-10-09', endDate: '2026-10-11', place: '제주도', startTime: '', endTime: '' }

  it('제안을 돌려주고 빈 값은 뺀다', async () => {
    expect(await parseEventText('다음주 금요일부터 2박 3일 제주 여행', NOW, gemini(ok))).toEqual({
      title: '제주 여행',
      kind: '여행',
      startDate: '2026-10-09',
      endDate: '2026-10-11',
      place: '제주도',
    })
  })

  it("프롬프트에 오늘 날짜와 요일을 넣어 '다음주 금요일'을 계산하게 한다", async () => {
    const f = gemini(ok)
    await parseEventText('다음주 금요일 제주 여행', NOW, f)
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { body: string }).body)
    expect(body.contents[0].parts[0].text).toContain('2026-10-02(금요일')
  })

  it('하루짜리: 종료일이 시작일과 같거나 비면 endDate 를 뺀다', async () => {
    const r = await parseEventText('토요일 한강 피크닉', NOW, gemini({ ...ok, kind: '야외활동', startDate: '2026-10-03', endDate: '2026-10-03', startTime: '14:00' }))
    expect(r).toMatchObject({ kind: '야외활동', startDate: '2026-10-03', startTime: '14:00' })
    expect(r).not.toHaveProperty('endDate')
  })

  it('날짜를 모르거나 터무니없으면 422', async () => {
    await expect(parseEventText('여행 가고 싶다', NOW, gemini({ ...ok, understood: false, startDate: '' }))).rejects.toMatchObject({ status: 422 })
    await expect(parseEventText('옛날 일정', NOW, gemini({ ...ok, startDate: '2019-01-01' }))).rejects.toMatchObject({ status: 422 })
    await expect(parseEventText('먼 미래', NOW, gemini({ ...ok, startDate: '2099-01-01' }))).rejects.toMatchObject({ status: 422 })
  })

  it('잘못된 날짜 형식/종류는 AI 실패', async () => {
    await expect(parseEventText('x', NOW, gemini({ ...ok, startDate: '10월 9일' }))).rejects.toMatchObject({ status: 502 })
    await expect(parseEventText('x', NOW, gemini({ ...ok, kind: '회의' }))).rejects.toMatchObject({ status: 502 })
  })
})

describe('옷장·행거 사진에서 여러 벌 찾기', () => {
  it('두께·방풍·방수는 AI 에게 묻지 않는다 (종류/색/무늬만)', async () => {
    const f = gemini({ items: [item('체크 셔츠')] })
    await clothesFromPhoto(photo, f)
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { body: string }).body)
    const props = Object.keys(body.generationConfig.responseSchema.properties.items.items.properties)
    // 종류/색/무늬 외에는 모델이 종류를 따져 보게 하는 근거(evidence)와 확신도(confidence)뿐이다
    expect(props).toEqual(['label', 'type', 'color', 'pattern', 'evidence', 'confidence'])
  })

  it('행거에 걸린 바지를 알아보는 구분 단서를 지시문에 담는다', async () => {
    const f = gemini({ items: [item('체크 셔츠')] })
    await clothesFromPhoto(photo, f)
    const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { body: string }).body)
    const text: string = body.contents[0].parts[0].text
    for (const cue of ['허리밴드', '청(데님)', '발목 쪽 고무밴드', '상의/하의/겉옷']) expect(text).toContain(cue)
  })

  it('사진 속 옷 범위(하의만/상의만)를 알려 주면 종류 선택지와 지시문을 그 범위로 좁힌다', async () => {
    const sent = async (part: 'all' | 'top' | 'bottom') => {
      const f = gemini({ items: [item('검정 바지', '바지', '검정', '무지')] })
      await clothesFromPhoto(photo, f, part)
      const body = JSON.parse(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as { body: string }).body)
      return { enumTypes: body.generationConfig.responseSchema.properties.items.items.properties.type.enum as string[], text: body.contents[0].parts[0].text as string }
    }
    const bottom = await sent('bottom')
    expect(bottom.enumTypes).toEqual(['바지', '반바지', '치마'])
    expect(bottom.text).toContain('전부 하의')
    const top = await sent('top')
    expect(top.enumTypes).not.toContain('바지')
    expect(top.enumTypes).toContain('반팔')
    expect(top.text).toContain('전부 상의')
    const all = await sent('all')
    expect(all.enumTypes).toContain('바지')
    expect(all.enumTypes).toContain('반팔')
    expect(all.text).not.toContain('전부 하의')
  })

  it('확신도를 돌려주고, 빠지거나 이상한 값이면 보통으로 본다. 근거는 화면으로 보내지 않는다', async () => {
    const r = await clothesFromPhoto(photo, gemini({ items: [{ ...item('검정 바지', '바지', '검정', '무지'), evidence: '허리끈', confidence: '헷갈림' }, { ...item('회색 후드티', '후드티', '회색', '무지'), evidence: '모자', confidence: '확실' }, { ...item('베이지 바지', '바지', '베이지', '무지'), confidence: '모름' }, item('청바지', '바지', '파랑', '무지')] }))
    expect(r.map((x) => x.confidence)).toEqual(['헷갈림', '확실', '보통', '보통'])
    expect(r.some((x) => 'evidence' in x)).toBe(false)
  })

  it('사진 전용 모델(GEMINI_PHOTO_MODEL)이 있으면 그 모델로 부른다', async () => {
    const saved = env.GEMINI_PHOTO_MODEL
    env.GEMINI_PHOTO_MODEL = 'photo-model-x'
    try {
      const f = gemini({ items: [item('체크 셔츠')] })
      await clothesFromPhoto(photo, f)
      expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain('photo-model-x')
    } finally {
      env.GEMINI_PHOTO_MODEL = saved
    }
  })

  const item = (label: string, type = '긴팔', color = '네이비', pattern = '체크') => ({ label, type, color, pattern })

  it('찾은 옷 목록을 돌려준다', async () => {
    const r = await clothesFromPhoto(photo, gemini({ items: [item('체크 셔츠'), item('검정 폴로', '긴팔', '검정', '무지')] }))
    expect(r.map((x) => x.label)).toEqual(['체크 셔츠', '검정 폴로'])
    expect(r[1]).toMatchObject({ type: '긴팔', color: '검정' })
    expect(r[0]).toMatchObject({ color: '네이비', pattern: '체크' })
  })

  it('최대 12벌까지만 돌려준다', async () => {
    const many = Array.from({ length: 20 }, (_, i) => item('옷' + i))
    expect(await clothesFromPhoto(photo, gemini({ items: many }))).toHaveLength(12)
  })

  it('새 색(네이비·카키 등)과 무늬를 받아들이고, 목록에 없는 무늬는 AI 실패로 처리한다', async () => {
    const ok = await clothesFromPhoto(photo, gemini({ items: [item('남색 줄무늬', '긴팔', '네이비', '줄무늬'), item('카키 폴로', '긴팔', '카키', '무지')] }))
    expect(ok.map((x) => [x.color, x.pattern])).toEqual([['네이비', '줄무늬'], ['카키', '무지']])
    await expect(clothesFromPhoto(photo, gemini({ items: [item('x', '긴팔', '네이비', '호피')] }))).rejects.toMatchObject({ status: 502 })
  })

  it('옷을 하나도 못 찾으면 422', async () => {
    await expect(clothesFromPhoto(photo, gemini({ items: [] }))).rejects.toMatchObject({ status: 422, code: 'NOT_CLOTHING' })
  })

  it('목록에 없는 종류가 섞이면 AI 실패로 처리한다', async () => {
    await expect(clothesFromPhoto(photo, gemini({ items: [item('x', '우주복')] }))).rejects.toMatchObject({ status: 502 })
  })
})
