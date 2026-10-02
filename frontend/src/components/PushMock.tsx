import { Link } from 'react-router-dom'
import HandText from './HandText'

// UI 목업 전용: 실제 Web Push 구현 없음
export default function PushMock({ title, to }: { title: string; to: string }) {
  return (
    <div className="box push w1" role="note">
      <div className="push-top">
        <span className="tiny">알림 · 지금</span>
        <span className="tiny">(Push 미리보기)</span>
      </div>
      <p className="push-msg">
        {title} 옷차림이 생성되었어요!
        <br />
        확인하러 갈까요?
      </p>
      <Link to={to} className="dbtn w2 small">
        <HandText>확인하러 가기</HandText>
      </Link>
    </div>
  )
}
