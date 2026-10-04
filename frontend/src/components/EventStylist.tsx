import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api'
import { BASIC_WEAR, useCharacter } from '../lib/character'
import { feel } from '../lib/styleText'
import { categories } from '../mocks/clothes'
import DoodleButton from './DoodleButton'
import SayBox from './SayBox'
import StickPerson from './StickPerson'
import type { ApiOutfitItem } from '../types'

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
interface PreviewOutfit {
  items: ApiOutfitItem[]
  styleMatched: boolean
}
interface StylistResponse extends Talk {
  style?: StyleId
  outfit?: PreviewOutfit | null
}
/** 눌러본 분위기. outfit 이 null 이면 아직 예보가 없어서 옷은 못 보여주고 분위기만 정해 둔 상태 */
interface Preview {
  style: StyleId
  outfit: PreviewOutfit | null
}

interface Props {
  eventId: string
  /** 지금 일정에 보이는 코디(위의 "이렇게 입어요"). 캐릭터는 처음에 이걸 입고 있다 */
  items: ApiOutfitItem[]
  /** 일정에 저장된 분위기와 그 이름. 없으면 날씨만 보고 고른 코디 */
  style: StyleId | null
  styleLabel: string | null
  /** 미리보기에서 받은 옷을 화면용으로 다듬는다(옷장에 없는 옷의 일반 색 등) */
  fillItems?: (items: ApiOutfitItem[]) => ApiOutfitItem[]
  /** 분위기를 확정하거나 해제해서 일정 코디가 바뀌었을 때(위쪽을 다시 불러온다) */
  onChanged: () => void
}

const itemsKey = (its: ApiOutfitItem[]) => its.map((i) => `${i.type}:${i.clothingId ?? i.label}`).join('|')

/**
 * 일정 상세의 코디 도우미: 칩을 누르거나 직접 말하면 캐릭터가 그 느낌의 옷으로 갈아입어 보여준다(저장 전 미리보기).
 * "이걸로 할래요"를 눌러야 일정에 저장되고 위의 "이렇게 입어요"가 바뀐다. 옷은 Rule Engine 이 고르고 AI 는 말만 거든다.
 */
export default function EventStylist({ eventId, items, style, styleLabel, fillItems, onChanged }: Props) {
  const character = useCharacter().data
  const [opening, setOpening] = useState<Talk | null>(null) // 처음 건 말과 기본 칩
  const [talk, setTalk] = useState<Talk | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const touched = useRef(false) // 사용자가 직접 고르거나 바꾸기 시작했는가
  const [applicable, setApplicable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')

  const savedReply = style ? `${feel(styleLabel ?? '')}으로 골랐어요. 다른 느낌도 눌러서 입어볼 수 있어요.` : null

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
        const r = await api<StylistResponse>('POST', '/api/ai/event-stylist', { eventId, preview: true, history: lastReply ? [{ role: 'ai', text: lastReply }] : [], ...body })
        setTalk({ reply: r.reply, options: r.options })
        setText('')
        if (r.style) setPreview({ style: r.style, outfit: r.outfit ?? null })
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [eventId],
  )

  // 미리보기로 본 느낌을 일정에 저장한다: 위의 코디가 이걸로 바뀐다
  const confirm = async () => {
    if (!preview) return
    touched.current = true
    setBusy(true)
    setError('')
    try {
      const r = await api<StylistResponse>('POST', '/api/ai/event-stylist', { eventId, style: preview.style })
      setTalk({ reply: `${r.reply}`, options: [] })
      setPreview(null)
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    touched.current = true
    setBusy(true)
    setError('')
    try {
      await api('DELETE', `/api/ai/event-stylist/${eventId}`)
      setTalk(opening)
      setPreview(null)
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const shown = preview?.outfit ? (fillItems ? fillItems(preview.outfit.items) : preview.outfit.items) : items
  const pick = (types: string[]) => shown.find((it) => types.includes(it.type))
  const wear = shown.length > 0 ? { top: pick(categories[0]!.types), bottom: pick(categories[1]!.types), outer: pick(categories[2]!.types) } : BASIC_WEAR

  // 별 조건 없는 여행·등산 같은 일정은 날씨 엔진이 이미 반영하므로 보여주지 않는다(이미 분위기를 골라 둔 일정은 바꿀 수 있게 계속 보여준다)
  if (applicable === false && !style) return null

  // 칩: 말로 되물어 온 선택지가 있으면 그걸, 없으면 처음 칩 중 2개
  const chips = ((talk?.options.length ? talk.options : opening?.options) ?? []).slice(0, 2)
  const activeStyle = preview?.style ?? style
  const sameAsTop = !!preview?.outfit && items.length > 0 && itemsKey(preview.outfit.items) === itemsKey(items)
  const canConfirm = !!preview && preview.style !== style

  return (
    <>
      <hr className="scribble" />
      <section className="section stylist">
        <div className="stylist-talk">
          <div className="stylist-figure">
            <div key={itemsKey(shown)} className="stylist-swap">
              <StickPerson mood="stand" size={104} wear={wear} persona={null} accessories={character?.unlocked ? character.config : undefined} />
            </div>
          </div>
          <div className="box w2 stylist-bubble" role="status" aria-live="polite">
            <p>{busy ? '잠깐만요, 옷장을 뒤져볼게요…' : (talk?.reply ?? '…')}</p>
            {!busy && preview?.outfit && (
              <ul className="stylist-wear tiny" aria-label="이 느낌으로 입으면">
                {shown.map((it) => (
                  <li key={`${it.type}-${it.clothingId ?? it.label}`}>{it.label}</li>
                ))}
              </ul>
            )}
            {!busy && sameAsTop && <p className="tiny">지금 위에 있는 코디와 같은 옷이에요.</p>}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="stylist-options" role="group" aria-label="입고 싶은 느낌">
            {chips.map((o, i) => (
              <DoodleButton key={o.style} seed={i} selected={activeStyle === o.style} disabled={busy} onClick={() => void ask({ style: o.style }, talk?.reply)}>
                {o.label}
              </DoodleButton>
            ))}
          </div>
        )}

        {(canConfirm || (style && !preview)) && (
          <div className="stylist-options">
            {canConfirm && (
              <DoodleButton seed={4} selected disabled={busy} onClick={() => void confirm()}>
                이걸로 할래요
              </DoodleButton>
            )}
            {style && (
              <button type="button" className="linklike tiny" disabled={busy} onClick={() => void clear()}>
                날씨만 보고 고르기
              </button>
            )}
          </div>
        )}

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
      </section>
    </>
  )
}
