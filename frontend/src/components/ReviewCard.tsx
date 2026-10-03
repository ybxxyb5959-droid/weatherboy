import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks'
import { dismissReview, getReviewStatus, snoozeReview } from '../lib/reviews'
import HandText from './HandText'

/**
 * 홈 아래쪽의 후기 요청 카드. 서버가 "지금 보여줄 때"라고 할 때만 뜬다(여러 날 써본 사람, 아직 안 쓴 사람).
 * 나중에: 며칠 뒤 다시 / 다시 안 볼래요: 영영 안 뜬다. 후기를 남기면 카드는 다시 뜨지 않는다.
 */
export default function ReviewCard() {
  const status = useAsync(getReviewStatus)
  const [hidden, setHidden] = useState(false)
  if (hidden || !status.data?.show) return null

  // 서버 기록은 조용히 하고, 화면에서는 바로 닫는다
  const later = () => {
    setHidden(true)
    void snoozeReview().catch(() => undefined)
  }
  const never = () => {
    setHidden(true)
    void dismissReview().catch(() => undefined)
  }

  return (
    <section className="box w2 review-card" aria-label="후기 요청">
      <h2>
        <HandText>뭐입을옷?, 써보니 어때요?</HandText>
      </h2>
      <p className="tiny">후기를 남겨주시면 더 나은 앱으로 보답할게요 ^_^</p>
      <div className="row">
        <Link to="/review" className="dbtn w1">
          후기 남기기
        </Link>
        <button type="button" className="dbtn small" onClick={later}>
          나중에
        </button>
      </div>
      <button type="button" className="skip-link" onClick={never}>
        다시 안 볼래요
      </button>
    </section>
  )
}
