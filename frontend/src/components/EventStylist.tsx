import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api'
import { BASIC_WEAR, useCharacter } from '../lib/character'
import { feel } from '../lib/styleText'
import { categories } from '../mocks/clothes'
import ClothingDoodle from './ClothingDoodle'
import DoodleButton from './DoodleButton'
import SayBox from './SayBox'
import StickPerson from './StickPerson'
import UmbrellaDoodle from './UmbrellaDoodle'
import WardrobeScene from './WardrobeScene'
import type { ApiOutfitItem, ApiRecommendation, EventOutfit } from '../types'

export type StyleId = 'FORMAL' | 'SMART' | 'CASUAL' | 'COMFORT'
interface StyleOption {
  style: StyleId
  label: string
}
interface Talk {
  reply: string
  options: StyleOption[]
  /** false 면 이 일정에는 도우미를 보여주지 않는다(별 조건 없는 여행·등산 등) */
  applicable?: boolean
}
/** 고른 분위기로 뽑은 코디 */
interface Look {
  items: ApiOutfitItem[]
  alternatives: ApiOutfitItem[][]
  headline: string
  sub: string
  needUmbrella: boolean
  needMask: boolean
}
interface StylistResponse extends Talk {
  style?: StyleId
  outfit?: Look | null
}
/** 갈아입는 연출 단계: 옷장으로 달려가기 → 뒤적이기 → 옷장 뒤에서 갈아입기 → 돌아오기 */
export type StagePhase = 'idle' | 'run' | 'dig' | 'change' | 'back'

interface Props {
  eventId: string
  /** 일정에 지금 저장된 코디(분위기를 골랐거나 "날씨만 보고"일 때 보여준다). 예보가 없으면 null */
  rec: ApiRecommendation | null
  /** 일정에 저장된 분위기와 그 이름. 없으면 날씨만 보고 고른 코디 */
  style: StyleId | null
  styleLabel: string | null
  /** 이 일정의 코디 근거 한 줄들(어색한 점 등) */
  notes?: string[]
  /** 옷장에 없는 옷의 일반 색 등 화면용으로 다듬는다 */
  fillItems?: (items: ApiOutfitItem[]) => ApiOutfitItem[]
  /** 이 도우미가 화면에 나오는지 알린다(안 나오면 위쪽이 코디 카드를 대신 보여준다) */
  onApplicable?: (on: boolean) => void
  /** 며칠짜리 일정: 코디는 날짜별 카드(아래쪽)가 보여주므로 여기서는 카드를 펼치지 않고 캐릭터만 갈아입는다 */
  multiDay?: boolean
  /** 분위기가 저장/해제되어 일정 코디가 바뀌었을 때(위쪽 데이터를 다시 불러온다) */
  onChanged: () => void
}

const itemsKey = (its: ApiOutfitItem[]) => its.map((i) => `${i.type}:${i.clothingId ?? i.label}`).join('|')
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * 일정 상세의 코디 도우미: 캐릭터가 "어떤 느낌으로 입을까요?" 하고 묻고, 칩을 누르거나 직접 말하면
 * 옷장으로 달려가 뒤적이고 갈아입은 모습으로 돌아온 뒤 코디 카드가 졸라맨 아래로 차례로 펼쳐진다.
 * 옷은 Rule Engine 이 고르고 AI 는 말만 거든다. 일정에 저장하는 것은 "느낌"뿐이고(옷은 날씨·옷장으로 매번 다시 계산),
 * 다른 조합은 저장하지 않고 구경만 한다.
 */
export default function EventStylist({ eventId, rec, style, styleLabel, notes = [], fillItems, onApplicable, multiDay = false, onChanged }: Props) {
  const character = useCharacter().data
  const [opening, setOpening] = useState<Talk | null>(null) // 처음 건 말과 기본 칩
  const [talk, setTalk] = useState<Talk | null>(null)
  const [chosen, setChosen] = useState<Look | null>(null) // 방금 고른 느낌의 코디
  const [weatherOnly, setWeatherOnly] = useState(false)
  const [altIdx, setAltIdx] = useState(0) // 0=추천, 1..=다른 조합(구경만)
  const touched = useRef(false) // 사용자가 직접 고르거나 바꾸기 시작했는가
  const [applicable, setApplicable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<StagePhase>('idle')
  const [frozen, setFrozen] = useState<ApiOutfitItem[] | null>(null) // 갈아입기 전까지 캐릭터가 입고 있던 옷
  const [runPx, setRunPx] = useState(150) // 옷장까지 달려갈 거리
  const rowRef = useRef<HTMLDivElement>(null)
  const shownRef = useRef<ApiOutfitItem[]>([])
  const changedRef = useRef(false) // 연출이 끝난 뒤에 일정 데이터를 다시 불러온다(날짜별 코디 카드가 갈아입은 뒤에 갱신되도록)

  const savedReply = style ? `${feel(styleLabel ?? '')}으로 골라봤어요. 다른 느낌도 눌러볼 수 있어요.` : null

  // 처음 열면 캐릭터가 먼저 말을 건다. 이미 고른 분위기가 있으면 그걸 알려준다.
  useEffect(() => {
    let alive = true
    api<Talk>('GET', `/api/ai/event-stylist/${eventId}/start`)
      .then((start) => {
        if (!alive) return
        setOpening(start)
        setApplicable(start.applicable !== false)
        setTalk((cur) => cur ?? (savedReply ? { reply: savedReply, options: [] } : start))
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
    // 처음 한 번만: 이후 대화 상태는 아래 동작들이 직접 바꾼다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const visible = applicable !== false || !!style
  useEffect(() => {
    if (applicable !== null) onApplicable?.(visible)
  }, [applicable, visible, onApplicable])

  // 저장된 분위기는 일정 코디와 같이 늦게 도착할 수 있다: 아직 아무것도 건드리지 않았다면 그 상태로 말을 바꿔준다
  useEffect(() => {
    if (style && !touched.current && savedReply) setTalk({ reply: savedReply, options: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, styleLabel])

  /**
   * 일을 하는 동안 졸라맨이 옷장으로 달려가 뒤적이고, 끝나면 옷장 뒤에서 갈아입고 돌아온다.
   * 서버 응답이 빨라도 뒤적이는 모습은 잠깐 보여주고, 느리면 응답이 올 때까지 계속 뒤적인다.
   * "동작 줄이기"를 켠 사람은 연출 없이 바로 바꾼다.
   */
  const stage = useCallback(async (work: () => Promise<void>) => {
    touched.current = true
    setBusy(true)
    setError('')
    const run = async () => {
      try {
        await work()
      } catch (e) {
        setError(errorMessage(e))
      }
    }
    const flush = () => {
      if (changedRef.current) {
        changedRef.current = false
        onChanged()
      }
    }
    if (reducedMotion()) {
      await run()
      setBusy(false)
      flush()
      return
    }
    setFrozen(shownRef.current)
    setRunPx(Math.max(90, (rowRef.current?.offsetWidth ?? 340) - 104 - 6 - 72))
    setPhase('run')
    await sleep(450)
    setPhase('dig')
    const t0 = Date.now()
    await run()
    await sleep(Math.max(0, 900 - (Date.now() - t0)))
    setPhase('change')
    await sleep(250)
    setFrozen(null)
    setPhase('back')
    await sleep(450)
    setPhase('idle')
    setBusy(false)
    flush()
  }, [onChanged])

  const ask = (body: { style?: StyleId; text?: string }, lastReply?: string) =>
    stage(async () => {
      const r = await api<StylistResponse>('POST', '/api/ai/event-stylist', { eventId, history: lastReply ? [{ role: 'ai', text: lastReply }] : [], ...body })
      setTalk({ reply: r.reply, options: r.options })
      setText('')
      if (r.style) {
        setWeatherOnly(false)
        setAltIdx(0)
        setChosen(r.outfit ?? null)
        changedRef.current = true // 느낌이 저장됐다: 연출이 끝나면 일정 데이터를 다시 불러온다
      }
    })

  // 고른 느낌을 풀고, 날씨와 옷장만으로 고른 기본 코디를 보여준다
  const releaseStyle = () =>
    stage(async () => {
      await api('DELETE', `/api/ai/event-stylist/${eventId}`)
      const o = await api<EventOutfit>('GET', `/api/events/${eventId}/outfit`)
      const r = o.recommendation
      setChosen(r ? { items: r.items, alternatives: r.alternatives ?? [], headline: r.headline, sub: r.sub, needUmbrella: r.needUmbrella, needMask: r.needMask } : null)
      setWeatherOnly(true)
      setAltIdx(0)
      setTalk({ reply: '느낌은 풀고, 날씨와 내 옷장만 보고 골라봤어요.', options: [] })
      changedRef.current = true
    })

  // 지금 보여줄 코디: 방금 고른 것 > 저장돼 있거나 "날씨만 보고"를 고른 일정 코디
  const base: Look | null =
    chosen ?? (rec && (style || weatherOnly) ? { items: rec.items, alternatives: rec.alternatives ?? [], headline: rec.headline, sub: rec.sub, needUmbrella: rec.needUmbrella, needMask: rec.needMask } : null)
  const combos = base ? [base.items, ...base.alternatives] : []
  const idx = base ? altIdx % combos.length : 0
  const rawItems = base ? combos[idx]! : (rec?.items ?? [])
  const shown = fillItems ? fillItems(rawItems) : rawItems
  shownRef.current = shown
  // 연출 중에는 갈아입기 전 옷을 그대로 입고 있다가, 옷장 뒤에서 새 옷으로 바뀐다
  const wearItems = frozen ?? shown
  const pick = (types: string[]) => wearItems.find((it) => types.includes(it.type))
  const wear = wearItems.length > 0 ? { top: pick(categories[0]!.types), bottom: pick(categories[1]!.types), outer: pick(categories[2]!.types) } : BASIC_WEAR

  // 별 조건 없는 여행·등산 같은 일정은 날씨 엔진이 이미 반영하므로 보여주지 않는다(이미 분위기를 골라 둔 일정은 바꿀 수 있게 계속 보여준다)
  if (!visible) return null

  const hasPicked = !!style || !!chosen // 한 번 고르면 칩은 사라지고, 입력창이 "원하는 옷이 아닌가요?"로 바뀐다
  const chips = ((talk?.options.length ? talk.options : opening?.options) ?? []).slice(0, 2)
  const comboKey = `${idx}:${itemsKey(shown)}`
  const staging = phase !== 'idle'

  return (
    <>
      <hr className="scribble" />
      <section className="section stylist">
        <div ref={rowRef} className="stylist-talk" data-phase={phase} style={{ ['--run' as string]: `${runPx}px` }}>
          <div className="stylist-figure">
            <div className="stage-figure">
              <div key={staging ? 'stage' : comboKey} className={staging ? 'stage-body' : 'stylist-swap'}>
                <StickPerson mood="stand" size={104} wear={wear} persona={null} accessories={character?.unlocked ? character.config : undefined} />
              </div>
            </div>
          </div>
          {staging ? (
            <WardrobeScene phase={phase} />
          ) : (
            <div className="box w2 stylist-bubble" role="status" aria-live="polite">
              <p>{busy ? '잠깐만요, 옷장을 뒤져볼게요…' : (talk?.reply ?? '…')}</p>
            </div>
          )}
        </div>

        {/* 칩은 고르기 전에만 보인다. 고른 뒤 마음에 안 들면 아래 입력창에 원하는 스타일을 말하면 된다 */}
        {!hasPicked && chips.length > 0 && (
          <div className="stylist-options" role="group" aria-label="입고 싶은 느낌">
            {chips.map((o, i) => (
              <DoodleButton key={o.style} seed={i} disabled={busy} onClick={() => void ask({ style: o.style }, talk?.reply)}>
                {o.label}
              </DoodleButton>
            ))}
          </div>
        )}

        <div className="stylist-say">
          {hasPicked && <p className="tiny stylist-ask">원하는 옷이 아닌가요? 원하는 스타일을 말씀해주세요</p>}
          <SayBox
            id="stylist-say"
            label={hasPicked ? '원하는 스타일 말하기' : '어떻게 입고 싶은지 직접 말하기'}
            placeholder={hasPicked ? '예) 좀 더 편하게 입고 싶어' : '예) 면접인데 단정하게 입고 싶어'}
            value={text}
            onChange={setText}
            onSubmit={(t) => {
              const v = (t ?? text).trim()
              if (v.length >= 2) void ask({ text: v }, talk?.reply)
            }}
            busy={busy}
            busyLabel="고르는 중…"
            submitLabel="보내기"
            submitOnVoice
          />
        </div>

        {style && !busy && phase === 'idle' && (
          <button type="button" className="linklike tiny" onClick={() => void releaseStyle()}>
            고른 느낌 풀고 날씨와 옷장만 보고 고르기
          </button>
        )}

        {error && (
          <p className="tiny" role="alert">
            {error}
          </p>
        )}

        {base && !multiDay && !busy && phase === 'idle' && (
          <div className="look-wrap" aria-live="polite">
            <div key={comboKey} className="box w3 look-cards">
              {shown.map((it, i) => (
                <div key={`${it.type}-${it.clothingId ?? it.label}`} className="look-card" style={{ ['--i' as string]: i }}>
                  <ClothingDoodle type={it.type} color={it.color} pattern={it.pattern} size={64} />
                  <div className="tiny">{it.label}</div>
                </div>
              ))}
              {base.needUmbrella && (
                <div className="look-card" style={{ ['--i' as string]: shown.length }}>
                  <UmbrellaDoodle size={64} />
                  <div className="tiny">우산</div>
                </div>
              )}
            </div>
            <p className="tiny">
              {idx === 0 ? `${base.headline} · ${base.sub}` : '구경용 다른 조합이에요. 저장되지 않아요.'}
              {base.needMask ? ' · 마스크도 챙겨요' : ''}
            </p>
            {notes.map((n) => (
              <p key={n} className="tiny">
                {n}
              </p>
            ))}
            {combos.length > 1 && (
              <div className="stylist-options">
                <DoodleButton seed={3} className="small" onClick={() => setAltIdx((n) => (n + 1) % combos.length)}>
                  다른 조합 보기 ({idx + 1}/{combos.length})
                </DoodleButton>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
