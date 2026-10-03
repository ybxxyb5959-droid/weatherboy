import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, errorMessage } from '../api'
import BackButton from '../components/BackButton'
import HandText from '../components/HandText'
import { useAsync } from '../hooks'
import { getReviewStatus, submitReview } from '../lib/reviews'

const MAX = 1000
const FACES = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요']

/** 별점 얼굴: 1(찡그림) ~ 5(활짝). 볼펜 낙서 스타일의 작은 졸라맨 얼굴 */
function RatingFace({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const mouth = {
    1: 'M13 31 Q20 24 27 31',
    2: 'M14 29 L26 29',
    3: 'M14 28 Q20 32 26 28',
    4: 'M12 27 Q20 35 28 27',
    5: 'M11 26 Q20 38 29 26 Z',
  }[level]
  return (
    <svg className="doodle" width="46" height="46" viewBox="0 0 40 40" fill="none" stroke="#222" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="20" cy="20" r="16" />
      {level === 1 ? (
        <path d="M11 14 L16 16 M29 14 L24 16" />
      ) : (
        <>
          <circle cx="14" cy="17" r="1.6" fill="#222" stroke="none" />
          <circle cx="26" cy="17" r="1.6" fill="#222" stroke="none" />
        </>
      )}
      <path d={mouth} fill={level === 5 ? '#f2b8a8' : 'none'} />
    </svg>
  )
}

export default function ReviewPage() {
  const nav = useNavigate()
  const status = useAsync(getReviewStatus)
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!rating || busy) return
    setBusy(true)
    setError('')
    try {
      await submitReview(rating, message.trim())
      setDone(true)
    } catch (e) {
      // 이미 남긴 경우(다른 기기 등)도 감사 화면으로
      if (e instanceof ApiError && e.code === 'ALREADY_REVIEWED') setDone(true)
      else setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const head = (
    <div className="page-head">
      <div className="row">
        <BackButton label="뒤로 가기" />
        <h1>후기 남기기</h1>
      </div>
    </div>
  )

  if (status.loading) return <main>{head}<p>불러오는 중…</p></main>

  if (done || status.data?.reviewed) {
    return (
      <main className="review">
        {head}
        <section className="review-thanks">
          <p className="lead">
            <HandText>{done ? '후기 고마워요! ^_^' : '이미 후기를 남겨주셨어요.'}</HandText>
          </p>
          <p className="tiny">남겨주신 이야기는 운영자에게만 전달돼요. 더 나은 서비스로 찾아뵙겠습니다 ^__^</p>
          <button type="button" className="dbtn block w1" onClick={() => nav('/home', { replace: true })}>
            홈으로
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="review">
      {head}
      <p className="tiny">써보신 느낌을 편하게 남겨주세요. 한 번만 남길 수 있어요.</p>

      <section>
        <h2>
          <HandText>전체적으로 어땠어요?</HandText>
        </h2>
        <div className="review-faces" role="radiogroup" aria-label="별점">
          {FACES.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={rating === i + 1}
              className={`review-face${rating === i + 1 ? ' on' : ''}`}
              onClick={() => setRating(i + 1)}
            >
              <RatingFace level={(i + 1) as 1 | 2 | 3 | 4 | 5} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>
          <HandText>하고 싶은 말(선택)</HandText>
        </h2>
        <textarea
          className="review-text"
          rows={6}
          maxLength={MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="좋았던 점, 불편했던 점, 있으면 좋겠는 기능 뭐든 좋아요 ^_^"
        />
        <p className="tiny review-count">
          {message.length} / {MAX}
        </p>
      </section>

      {error && <p role="alert">{error}</p>}
      <button type="button" className="dbtn block w1" onClick={() => void submit()} disabled={!rating || busy}>
        {busy ? '보내는 중…' : '후기 보내기'}
      </button>
      {!rating && <p className="tiny">별점을 먼저 골라주세요.</p>}
    </main>
  )
}
