import type { AiUsage } from '../lib/useAiUsage'

/** 이 값 이하로 남으면 알려 준다(넉넉할 때는 아무것도 보이지 않는다) */
const WARN_AT = 30

/** 오늘 사진 인식 사용량 안내: 넉넉하면 숨기고, 30% 이하로 남았을 때와 다 썼을 때만 한 줄로 알려 준다. */
export default function AiUsageBar({ usage }: { usage: AiUsage | null }) {
  if (!usage) return null
  if (!usage.open) {
    return <p className="tiny usage-closed">오늘은 AI 사용이 많아서 잠시 쉬어요. 직접 등록해 주세요.</p>
  }
  if (!usage.photo) return null
  const pct = usage.photo.remainingPct
  if (pct > WARN_AT) return null
  return (
    <p className="tiny usage-closed" role="status">
      {pct <= 0 ? '오늘 사진 인식은 다 썼어요. 내일 다시 쓸 수 있어요. 지금은 직접 등록해 주세요.' : `오늘 사진 인식이 ${pct}% 남았어요.`}
    </p>
  )
}
