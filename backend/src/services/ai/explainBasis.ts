// AI 설명이 "어떤 조건에서 만들어진 문장인지"를 기억하고, 보여줄 때 지금 조건과 같은지 비교한다.
// 조건이 달라졌으면 AI 를 다시 부르지 않고 템플릿 문장을 보여준다(한도·비용 때문에 재생성은 하지 않는다).
import type { EngineResult } from '../../rules/outfitEngine.js'
import { templateExplanation } from './explain.js'

/**
 * 추천과 함께 저장하는 외출 구간. 설명이 어느 구간 기준인지 비교하는 데 쓴다.
 * 오늘 추천의 시작/끝은 "지금"에 맞춰 계속 밀리므로(지난 시간 제외, 남은 시간이 짧으면 지금부터 3시간) 그대로 비교하면 항상 달라진다.
 * 그래서 의미 있는 변화만 담는다: 구간의 종류(source)와, 밀리지 않는 값만(시작·끝이 고정인 일정은 둘 다, 오늘 추천은 기준 종료 시각만, NOW 는 둘 다 null).
 */
export interface Outing {
  source: string
  startAt: string | null
  endAt: string | null
}
/** 저장된 추천(resultJson)의 모양: 엔진 결과 + 저장할 때 붙이는 값 */
export type StoredResult = EngineResult & { forecastStage?: string; outing?: Outing }

export interface ExplainBasis {
  /** 판단 기온을 5°C 단위로 묶은 기온대(예: 12°C → 2). 조금 흔들리는 것까지 다른 조건으로 보지 않는다 */
  tempBand: number
  rain: boolean
  umbrella: boolean
  source: string | null
  startAt: string | null
  endAt: string | null
}
export interface ExplainMeta {
  /** ai: AI 가 만든 문장 / template: 한도·실패로 템플릿을 저장함 */
  source: 'ai' | 'template'
  basis: ExplainBasis
}

export const TEMP_BAND_SIZE = 5

export const explainBasisOf = (r: Pick<StoredResult, 'judgedTemp' | 'rainAt' | 'needUmbrella' | 'outing'>): ExplainBasis => ({
  tempBand: Math.floor(r.judgedTemp / TEMP_BAND_SIZE),
  rain: r.rainAt != null,
  umbrella: r.needUmbrella,
  source: r.outing?.source ?? null,
  startAt: r.outing?.startAt ?? null,
  endAt: r.outing?.endAt ?? null,
})

export const sameBasis = (a: ExplainBasis, b: ExplainBasis) =>
  a.tempBand === b.tempBand && a.rain === b.rain && a.umbrella === b.umbrella && a.source === b.source && a.startAt === b.startAt && a.endAt === b.endAt

/** 저장된 메타를 읽는다. 모양이 맞지 않으면(예전 행, 깨진 값) null. */
export function readMeta(v: unknown): ExplainMeta | null {
  const m = v as Partial<ExplainMeta> | null
  if (!m || (m.source !== 'ai' && m.source !== 'template') || !m.basis || typeof m.basis.tempBand !== 'number') return null
  return m as ExplainMeta
}

export interface ShownExplanation {
  text: string | null
  source: 'ai' | 'template' | null
}

/**
 * 화면에 보여줄 설명. 설명이 아직 없으면 null.
 * - 메타가 없는 예전 설명은 그대로 보여준다(비교할 조건이 없다).
 * - 템플릿 설명은 저장된 문장이 아니라 "지금 추천"으로 다시 만든 문장을 보여준다(날씨 문구가 항상 최신).
 * - AI 설명은 만들 때의 조건이 지금과 같을 때만 보여주고, 다르면 템플릿으로 대신한다.
 */
export function shownExplanation(r: StoredResult, stored: string | null, metaJson: unknown): ShownExplanation {
  if (stored == null) return { text: null, source: null }
  const meta = readMeta(metaJson)
  if (!meta) return { text: stored, source: 'ai' }
  if (meta.source === 'template') return { text: templateExplanation(r), source: 'template' }
  if (sameBasis(meta.basis, explainBasisOf(r))) return { text: stored, source: 'ai' }
  return { text: templateExplanation(r), source: 'template' }
}
