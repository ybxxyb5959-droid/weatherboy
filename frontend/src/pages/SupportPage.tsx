import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api'
import BackButton from '../components/BackButton'
import HandText from '../components/HandText'
import { sendSupport, type SupportKind } from '../lib/reviews'

const MAX = 1000
const KINDS: { kind: SupportKind; label: string; hint: string }[] = [
  { kind: 'BUG', label: '불편·오류', hint: '이상하거나 불편했던 점' },
  { kind: 'IDEA', label: '제안', hint: '이런 게 있으면 좋겠어요' },
  { kind: 'OTHER', label: '기타', hint: '그 밖의 이야기' },
]

/** 설정 > 의견·불편 보내기: 한 번만 쓰는 후기와 달리, 쓰다가 떠오를 때마다 여러 번 보낼 수 있다. */
export default function SupportPage() {
  const nav = useNavigate()
  const [kind, setKind] = useState<SupportKind>('BUG')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (message.trim().length < 2 || busy) return
    setBusy(true)
    setError('')
    try {
      await sendSupport(kind, message.trim())
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const head = (
    <div className="page-head">
      <div className="row">
        <BackButton to="/settings" label="설정으로 돌아가기" />
        <h1>의견·불편 보내기</h1>
      </div>
    </div>
  )

  if (sent) {
    return (
      <main className="review">
        {head}
        <section className="review-thanks">
          <p className="lead">
            <HandText>보내줘서 고마워요! ^_^</HandText>
          </p>
          <p className="tiny">운영자에게 바로 전달됐어요. 또 떠오르는 게 있으면 언제든 보내주세요.</p>
          <button
            type="button"
            className="dbtn block w2"
            onClick={() => {
              setMessage('')
              setSent(false)
            }}
          >
            하나 더 보내기
          </button>
          <button type="button" className="dbtn block w1" onClick={() => nav('/settings')}>
            설정으로
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="review">
      {head}
      <p className="tiny">쓰다가 불편하거나 이런 게 있으면 좋겠다 싶을 때 언제든 보내주세요. 여러 번 보내도 괜찮아요 ^_^</p>

      <section>
        <h2>
          <HandText>어떤 이야기예요?</HandText>
        </h2>
        <div className="support-kinds" role="radiogroup" aria-label="종류">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} className={`review-face support-kind${kind === k.kind ? ' on' : ''}`} onClick={() => setKind(k.kind)}>
              <b>{k.label}</b>
              <span>{k.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <textarea
          className="review-text"
          rows={6}
          maxLength={MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="어느 화면에서 어떤 점이 그랬는지 적어주면 고치기 쉬워요 ^_^"
          aria-label="내용"
        />
        <p className="tiny review-count">
          {message.length} / {MAX}
        </p>
      </section>

      {error && <p role="alert">{error}</p>}
      <button type="button" className="dbtn block w1" onClick={() => void submit()} disabled={message.trim().length < 2 || busy}>
        {busy ? '보내는 중…' : '보내기'}
      </button>
    </main>
  )
}
