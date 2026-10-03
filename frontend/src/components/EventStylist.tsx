import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { BASIC_WEAR, useCharacter } from '../lib/character'
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
}
interface StylistResponse extends Talk {
  style?: StyleId
}

interface Props {
  eventId: string
  /** 지금 일정에 보이는 코디(위의 "이렇게 입어요"). 캐릭터가 이걸 입고 있다 */
  items: ApiOutfitItem[]
  /** 일정에 저장된 분위기와 그 이름. 없으면 날씨만 보고 고른 코디 */
  style: StyleId | null
  styleLabel: string | null
  /** 분위기를 고르거나 해제해서 일정 코디가 바뀌었을 때(위쪽을 다시 불러온다) */
  onChanged: () => void
}

/**
 * 일정 상세의 코디 도우미: 내 캐릭터가 먼저 "어떤 느낌으로 입을까요?" 하고 말을 걸고,
 * 고른 느낌은 일정에 저장돼서 위의 "이렇게 입어요"가 그 코디로 바뀐다. 옷은 Rule Engine 이 고르고 AI 는 말만 거든다.
 */
export default function EventStylist({ eventId, items, style, styleLabel, onChanged }: Props) {
  const character = useCharacter().data
  const [opening, setOpening] = useState<Talk | null>(null) // 처음 건 말(다시 고를 때 돌아온다)
  const [talk, setTalk] = useState<Talk | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [say, setSay] = useState(false)
  const [text, setText] = useState('')

  // 처음 열면 캐릭터가 먼저 말을 건다. 이미 고른 분위기가 있으면 그걸 알려주고 바꿀 수 있게 한다.
  useEffect(() => {
    let alive = true
    api<Talk>('GET', `/api/ai/event-stylist/${eventId}/start`)
      .then((start) => {
        if (!alive) return
        setOpening(start)
        setTalk((cur) => cur ?? (style ? { reply: `${styleLabel ?? ''} 느낌으로 골랐어요. 다른 느낌이 좋으면 바꿔볼까요?`, options: [] } : start))
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
    // 처음 한 번만: 이후 대화 상태는 아래 동작들이 직접 바꾼다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const ask = useCallback(
    async (body: { style?: StyleId; text?: string }, lastReply?: string) => {
      setBusy(true)
      setError('')
      try {
        const r = await api<StylistResponse>('POST', '/api/ai/event-stylist', { eventId, history: lastReply ? [{ role: 'ai', text: lastReply }] : [], ...body })
        setTalk({ reply: r.reply, options: r.options })
        setSay(false)
        setText('')
        if (r.style) onChanged() // 분위기가 정해져 저장됐다: 위의 코디를 다시 불러온다
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [eventId, onChanged],
  )

  const clear = async () => {
    setBusy(true)
    setError('')
    try {
      await api('DELETE', `/api/ai/event-stylist/${eventId}`)
      setTalk(opening)
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const pick = (types: string[]) => items.find((it) => types.includes(it.type))
  const wear = items.length > 0 ? { top: pick(categories[0]!.types), bottom: pick(categories[1]!.types), outer: pick(categories[2]!.types) } : BASIC_WEAR
  const choosing = !!talk && talk.options.length > 0

  return (
    <section className="section stylist">
      <div className="stylist-talk">
        <div className="stylist-figure">
          <StickPerson mood="stand" size={104} wear={wear} persona={null} accessories={character?.unlocked ? character.config : undefined} />
        </div>
        <div className="box w2 stylist-bubble" role="status" aria-live="polite">
          <p>{busy ? '잠깐만요, 옷장을 뒤져볼게요…' : (talk?.reply ?? '…')}</p>
        </div>
      </div>

      {!busy && talk && talk.options.length > 0 && (
        <div className="stylist-options">
          {talk.options.map((o, i) => (
            <DoodleButton key={o.style} seed={i} onClick={() => void ask({ style: o.style })}>
              {o.label}
            </DoodleButton>
          ))}
        </div>
      )}

      {!busy && !choosing && opening && (
        <div className="stylist-options">
          <DoodleButton seed={1} onClick={() => setTalk(opening)}>
            {style ? '다른 느낌으로' : '느낌 고르기'}
          </DoodleButton>
          {style && (
            <DoodleButton seed={2} onClick={() => void clear()}>
              날씨만 보고 고르기
            </DoodleButton>
          )}
        </div>
      )}

      {error && (
        <p className="tiny" role="alert">
          {error}
        </p>
      )}

      {!busy && (
        <div className="stylist-say">
          {say ? (
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
          ) : (
            <DoodleButton seed={3} className="small" onClick={() => setSay(true)}>
              직접 말할래요
            </DoodleButton>
          )}
        </div>
      )}
    </section>
  )
}
