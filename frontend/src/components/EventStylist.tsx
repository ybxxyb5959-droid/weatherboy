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
import type { ApiOutfitItem, ApiRecommendation } from '../types'

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
  /** 분위기가 저장/해제되어 일정 코디가 바뀌었을 때(위쪽 데이터를 다시 불러온다) */
  onChanged: () => void
}

const itemsKey = (its: ApiOutfitItem[]) => its.map((i) => `${i.type}:${i.clothingId ?? i.label}`).join('|')

/**
 * 일정 상세의 코디 도우미: 캐릭터가 "어떤 느낌으로 입을까요?" 하고 묻고, 칩을 누르거나 직접 말하면
 * 갈아입은 모습과 함께 코디 카드가 졸라맨 아래로 차례로 펼쳐진다. 옷은 Rule Engine 이 고르고 AI 는 말만 거든다.
 * 일정에 저장하는 것은 "느낌"뿐이고(옷은 날씨·옷장으로 매번 다시 계산), 다른 조합은 저장하지 않고 구경만 한다.
 */
export default function EventStylist({ eventId, rec, style, styleLabel, notes = [], fillItems, onApplicable, onChanged }: Props) {
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

  const ask = useCallback(
    async (body: { style?: StyleId; text?: string }, lastReply?: string) => {
      touched.current = true
      setBusy(true)
      setError('')
      try {
        const r = await api<StylistResponse>('POST', '/api/ai/event-stylist', { eventId, history: lastReply ? [{ role: 'ai', text: lastReply }] : [], ...body })
        setTalk({ reply: r.reply, options: r.options })
        setText('')
        if (r.style) {
          setWeatherOnly(false)
          setAltIdx(0)
          setChosen(r.outfit ?? null)
          onChanged() // 느낌이 저장됐다: 일정 데이터를 다시 불러온다
        }
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [eventId, onChanged],
  )

  // "날씨만 보고": 저장된 느낌이 있으면 풀고, 날씨와 옷장만으로 고른 코디를 보여준다
  const pickWeatherOnly = async () => {
    touched.current = true
    setBusy(true)
    setError('')
    try {
      if (style) await api('DELETE', `/api/ai/event-stylist/${eventId}`)
      setChosen(null)
      setWeatherOnly(true)
      setAltIdx(0)
      setTalk({ reply: '날씨와 내 옷장만 보고 골라봤어요.', options: [] })
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // 지금 보여줄 코디: 방금 고른 것 > 저장돼 있거나 "날씨만 보고"를 고른 일정 코디
  const base: Look | null =
    chosen ?? (rec && (style || weatherOnly) ? { items: rec.items, alternatives: rec.alternatives ?? [], headline: rec.headline, sub: rec.sub, needUmbrella: rec.needUmbrella, needMask: rec.needMask } : null)
  const combos = base ? [base.items, ...base.alternatives] : []
  const idx = base ? altIdx % combos.length : 0
  const rawItems = base ? combos[idx]! : (rec?.items ?? [])
  const shown = fillItems ? fillItems(rawItems) : rawItems
  const pick = (types: string[]) => shown.find((it) => types.includes(it.type))
  const wear = shown.length > 0 ? { top: pick(categories[0]!.types), bottom: pick(categories[1]!.types), outer: pick(categories[2]!.types) } : BASIC_WEAR

  // 별 조건 없는 여행·등산 같은 일정은 날씨 엔진이 이미 반영하므로 보여주지 않는다(이미 분위기를 골라 둔 일정은 바꿀 수 있게 계속 보여준다)
  if (!visible) return null

  const chips = ((talk?.options.length ? talk.options : opening?.options) ?? []).slice(0, 2)
  const comboKey = `${idx}:${itemsKey(shown)}`

  return (
    <>
      <hr className="scribble" />
      <section className="section stylist">
        <div className="stylist-talk">
          <div className="stylist-figure">
            <div key={comboKey} className="stylist-swap">
              <StickPerson mood="stand" size={104} wear={wear} persona={null} accessories={character?.unlocked ? character.config : undefined} />
            </div>
          </div>
          <div className="box w2 stylist-bubble" role="status" aria-live="polite">
            <p>{busy ? '잠깐만요, 옷장을 뒤져볼게요…' : (talk?.reply ?? '…')}</p>
          </div>
        </div>

        <div className="stylist-options" role="group" aria-label="입고 싶은 느낌">
          {chips.map((o, i) => (
            <DoodleButton key={o.style} seed={i} selected={style === o.style} disabled={busy} onClick={() => void ask({ style: o.style }, talk?.reply)}>
              {o.label}
            </DoodleButton>
          ))}
          {rec && (
            <DoodleButton seed={chips.length} selected={weatherOnly && !style} disabled={busy} onClick={() => void pickWeatherOnly()}>
              날씨만 보고
            </DoodleButton>
          )}
        </div>

        <div className="stylist-say">
          <SayBox
            id="stylist-say"
            label="어떻게 입고 싶은지 직접 말하기"
            placeholder="예) 면접인데 단정하게 입고 싶어"
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

        {error && (
          <p className="tiny" role="alert">
            {error}
          </p>
        )}

        {base && !busy && (
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
