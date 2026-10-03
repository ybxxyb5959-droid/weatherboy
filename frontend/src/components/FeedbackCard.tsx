import { useLayoutEffect, useRef, useState } from 'react'
import FeedbackFace, { type FeelKind } from './FeedbackFace'

const feelOptions: { label: '추웠어요' | '딱 좋아요' | '더웠어요'; kind: FeelKind }[] = [
  { label: '추웠어요', kind: 'cold' },
  { label: '딱 좋아요', kind: 'good' },
  { label: '더웠어요', kind: 'hot' },
]

type Label = (typeof feelOptions)[number]['label']

interface Props {
  selected: string
  message: string
  /** 저장에 성공(또는 이미 저장됨)하면 true. 실패하면 false 를 돌려줘 카드를 원래대로 되돌린다. */
  onPick: (label: Label, followed: boolean) => Promise<boolean>
}

// 나머지 카드가 사라지는 시간 -> 고른 카드가 첫 칸으로 이동하는 시간(ms). global.css 의 fb-* 와 맞춘다.
const FADE_MS = 320
const MOVE_MS = 460

/**
 * 추천을 확인하고 몇 시간 뒤, 오늘 추천 위에 뜨는 후기 카드.
 * 하나를 고르면 나머지 두 장이 사라지고, 고른 카드가 첫 칸(추웠어요 자리)으로 옮겨간 뒤 감사 문구가 나온다.
 */
export default function FeedbackCard({ selected, message, onPick }: Props) {
  const [picked, setPicked] = useState<string>(selected)
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'moving' | 'done'>(selected ? 'done' : 'idle')
  const [dx, setDx] = useState(0)
  const [instant] = useState(!!selected) // 이미 고른 상태로 나타날 때는 애니메이션 없이 최종 모습으로
  // 추천대로 입지 않았으면 후기는 남기되 추천 보정에는 쓰지 않는다
  const [followed, setFollowed] = useState(true)
  const btns = useRef<(HTMLButtonElement | null)[]>([])

  const shiftOf = (label: string) => {
    const i = feelOptions.findIndex((o) => o.label === label)
    const a = btns.current[i]
    const first = btns.current[0]
    return a && first ? first.getBoundingClientRect().left - a.getBoundingClientRect().left : 0
  }

  useLayoutEffect(() => {
    if (selected && phase === 'done' && instant) setDx(shiftOf(selected))
  }, [selected, phase, instant])

  const pick = async (label: Label) => {
    if (phase !== 'idle') return
    setPicked(label)
    setPhase('leaving')
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const [ok] = await Promise.all([onPick(label, followed), wait(FADE_MS)])
    if (!ok) {
      setPhase('idle')
      setPicked('')
      return
    }
    setDx(shiftOf(label))
    setPhase('moving')
    await wait(MOVE_MS)
    setPhase('done')
  }

  // 고맙다는 말은 고른 카드 옆(사라진 두 장 자리)에, 저장 실패 같은 안내는 카드 아래에 보여준다
  const thanks = phase === 'done' && message ? message : ''
  const notice = phase === 'idle' && message ? message : ''
  return (
    <section className="section feedback-card">
      <div className="box w1">
        <h2>오늘 어땠나요?</h2>
        <p className="tiny">(후기는 다음 추천에 반영돼요)</p>
        {phase === "idle" && (
          <label className="tiny fb-followed">
            <input type="checkbox" checked={!followed} onChange={(e) => setFollowed(!e.target.checked)} /> 추천과 다른 옷을 입었어요
            {!followed && <span className="fb-followed-note">이번 후기는 추천에 반영하지 않아요</span>}
          </label>
        )}
        <div className={`row stretch fb-row fb-${phase}${instant ? ' fb-instant' : ''}`}>
          {feelOptions.map((o, i) => {
            const mine = picked === o.label
            return (
              <button
                key={o.label}
                type="button"
                className={`dbtn w${i + 1} fb-btn${mine ? ' on fb-mine' : phase !== 'idle' ? ' fb-gone' : ''}`}
                style={mine && (phase === 'moving' || phase === 'done') ? { transform: `translateX(${dx}px)` } : undefined}
                ref={(el) => {
                  btns.current[i] = el
                }}
                aria-pressed={mine}
                disabled={phase !== 'idle'}
                tabIndex={phase === 'idle' || mine ? 0 : -1}
                aria-hidden={phase !== 'idle' && !mine ? true : undefined}
                onClick={() => void pick(o.label)}
              >
                <FeedbackFace kind={o.kind} size={56} />
                <span>{o.label}</span>
              </button>
            )
          })}
          <p className={`fb-thanks fb-side${thanks ? ' show' : ''}`} role="status" aria-live="polite">
            {thanks}
          </p>
        </div>
        {notice && (
          <p className="tiny" role="status" style={{ marginTop: 8 }}>
            {notice}
          </p>
        )}
      </div>
    </section>
  )
}
