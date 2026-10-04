import type { AiUsage } from '../lib/useAiUsage'

/** 오늘 사진 인식 사용량: 막대는 "남은 양"이다. 많이 남으면 초록, 줄면 노랑, 거의 없으면 빨강. */
export default function AiUsageBar({ usage }: { usage: AiUsage | null }) {
  if (!usage) return null
  if (!usage.open) {
    return <p className="tiny usage-closed">오늘은 AI 사용이 많아서 잠시 쉬어요. 직접 등록해 주세요.</p>
  }
  if (!usage.photo) return null
  const pct = usage.photo.remainingPct
  const level = pct > 50 ? 'ok' : pct > 20 ? 'mid' : 'low'
  return (
    <div className="usage" role="img" aria-label={`오늘 사진 인식 ${pct}% 남음`}>
      <div className="usage-head">
        <span className="tiny">오늘 사진 인식</span>
        <span className="tiny usage-pct">{pct}% 남음</span>
      </div>
      <div className="usage-bar doodle">
        <div className={`usage-fill ${level}`} style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  )
}
