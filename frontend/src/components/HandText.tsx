import type { ReactNode } from 'react'

// 글자마다 기울기/높이/크기를 아주 조금씩 다르게 해서 사람이 쓴 글씨처럼 보이게 한다.
// 같은 글자는 항상 같은 모양(결정론적)이라 렌더링마다 흔들리지 않는다.
function jitter(code: number, i: number) {
  const h = (code * 31 + i * 17 + 7) % 97
  const rot = ((h % 9) - 4) * 0.9 // -3.6 ~ 3.6deg
  const dy = (((h >> 1) % 5) - 2) * 0.7 // -1.4 ~ 1.4px
  const sc = 1 + (((h >> 2) % 5) - 2) * 0.025 // 0.95 ~ 1.05
  return { rot, dy, sc }
}

export default function HandText({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>
  // 단어(띄어쓰기 단위)는 한 덩어리로 묶어서, 줄바꿈이 단어 중간에서 일어나지 않게 한다
  const words = children.split(' ')
  let idx = 0
  return (
    <span className="hand">
      {/* 보조기기/검색용 원문. 화면에는 아래 흔들린 글자가 보인다 */}
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {words.map((word, wi) => (
          <span key={wi}>
            {wi > 0 && ' '}
            <span className="hw">
              {Array.from(word).map((c) => {
                const i = idx++
                const { rot, dy, sc } = jitter(c.charCodeAt(0), i)
                return (
                  <span key={i} className="hc" style={{ transform: `translateY(${dy}px) rotate(${rot}deg) scale(${sc})` }}>
                    {c}
                  </span>
                )
              })}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
