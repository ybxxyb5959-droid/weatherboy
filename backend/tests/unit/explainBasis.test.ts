import { describe, expect, it } from 'vitest'
import { explainBasisOf, readMeta, sameBasis, shownExplanation, type ExplainMeta, type StoredResult } from '../../src/services/ai/explainBasis.js'

const result = (o: Partial<StoredResult> = {}) =>
  ({
    headline: '긴팔에 가디건',
    sub: '선선해요',
    judgedTemp: 12,
    rainAt: null,
    needUmbrella: false,
    outing: { source: 'DEFAULT', startAt: null, endAt: '2026-10-05T13:00:00.000Z' },
    ...o,
  }) as unknown as StoredResult
const aiMeta = (r: StoredResult): ExplainMeta => ({ source: 'ai', basis: explainBasisOf(r) })

describe('설명을 만들 때의 조건(basis)', () => {
  it('기온은 5°C 단위로 묶어서, 조금 흔들리는 건 같은 조건이다', () => {
    expect(sameBasis(explainBasisOf(result({ judgedTemp: 10.2 })), explainBasisOf(result({ judgedTemp: 14.8 })))).toBe(true)
    expect(sameBasis(explainBasisOf(result({ judgedTemp: 14.9 })), explainBasisOf(result({ judgedTemp: 15 })))).toBe(false)
  })
  it('비 여부·우산·외출 구간이 달라지면 다른 조건이다', () => {
    const base = explainBasisOf(result())
    expect(sameBasis(base, explainBasisOf(result({ rainAt: '2026-10-05T03:00:00.000Z' })))).toBe(false)
    expect(sameBasis(base, explainBasisOf(result({ needUmbrella: true })))).toBe(false)
    expect(sameBasis(base, explainBasisOf(result({ outing: { source: 'DEFAULT', startAt: null, endAt: '2026-10-05T10:00:00.000Z' } })))).toBe(false)
  })
})

describe('화면에 보여줄 설명', () => {
  it('설명이 아직 없으면 null', () => {
    expect(shownExplanation(result(), null, null)).toEqual({ text: null, source: null })
  })
  it('조건이 같으면 저장된 AI 문장을 그대로', () => {
    const r = result()
    expect(shownExplanation(r, 'AI 문장', aiMeta(r))).toEqual({ text: 'AI 문장', source: 'ai' })
  })
  it('조건이 달라졌으면 AI 문장 대신 지금 추천의 템플릿', () => {
    const made = result()
    const now = result({ rainAt: '2026-10-05T03:00:00.000Z', needUmbrella: true, headline: '우산을 챙기세요', sub: '비가 와요' })
    expect(shownExplanation(now, 'AI 문장', aiMeta(made))).toEqual({ text: '우산을 챙기세요. 비가 와요.', source: 'template' })
  })
  it('템플릿으로 저장된 설명은 항상 지금 추천으로 만든 문장을 보여준다', () => {
    const made = result()
    const now = result({ headline: '반팔', sub: '더워요', judgedTemp: 28 })
    const meta: ExplainMeta = { source: 'template', basis: explainBasisOf(made) }
    expect(shownExplanation(now, '긴팔에 가디건. 선선해요.', meta)).toEqual({ text: '반팔. 더워요.', source: 'template' })
  })
  it('조건 정보가 없는 예전 설명은 그대로 보여준다', () => {
    expect(shownExplanation(result(), '예전 문장', null)).toEqual({ text: '예전 문장', source: 'ai' })
    expect(shownExplanation(result(), '예전 문장', { broken: true })).toEqual({ text: '예전 문장', source: 'ai' })
  })
  it('저장된 메타의 모양이 틀리면 읽지 않는다', () => {
    expect(readMeta(undefined)).toBeNull()
    expect(readMeta({ source: 'x', basis: {} })).toBeNull()
    expect(readMeta(aiMeta(result()))).not.toBeNull()
  })
})
