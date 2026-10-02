import FeedbackFace, { type FeelKind } from './FeedbackFace'

const feelOptions: { label: '추웠어요' | '딱 좋아요' | '더웠어요'; kind: FeelKind }[] = [
  { label: '추웠어요', kind: 'cold' },
  { label: '딱 좋아요', kind: 'good' },
  { label: '더웠어요', kind: 'hot' },
]

interface Props {
  selected: string
  message: string
  onPick: (label: (typeof feelOptions)[number]['label']) => void
}

/** 추천을 확인하고 몇 시간 뒤, 오늘 추천 위에 뜨는 후기 카드 */
export default function FeedbackCard({ selected, message, onPick }: Props) {
  return (
    <section className="section feedback-card">
      <div className="box w1">
        <h2>오늘 어땠나요?</h2>
        <p className="tiny">(후기는 다음 추천에 반영돼요)</p>
        <div className="row stretch fb-row">
          {feelOptions.map((o, i) => (
            <button
              key={o.label}
              type="button"
              className={`dbtn w${i + 1} fb-btn${selected === o.label ? ' on' : ''}`}
              aria-pressed={selected === o.label}
              onClick={() => onPick(o.label)}
            >
              <FeedbackFace kind={o.kind} size={56} />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
        {message && <p className="tiny" style={{ marginTop: 8 }}>{message}</p>}
      </div>
    </section>
  )
}
