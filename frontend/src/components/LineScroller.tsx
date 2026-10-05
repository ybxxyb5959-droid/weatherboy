import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  label: string
  className: string
  /** 이 줄에 방금 걸린 옷 중 마지막 옷의 id. 그 옷이 보이도록 줄을 넘긴 뒤(새 옷은 줄 끝에 걸린다) onReady 를 부른다 */
  arriving: string | null
  /** 넘기기가 끝나 새 옷이 보이는 순간. 이때부터 걸리는 애니메이션을 시작한다. */
  onReady?: () => void
  /** 새 옷이 걸린 줄 중 첫 줄: 화면도 이 줄이 보이게 내린다 */
  focus?: boolean
  children: ReactNode
}

// 부드럽게 넘기는 데 걸리는 시간(대략). 브라우저마다 scrollend 가 없을 수 있어 시간으로도 끝을 본다.
const SCROLL_MS = 550

/**
 * 빨랫줄 한 줄. 옆으로 넘기는 줄이고, 화면 밖에 옷이 더 걸려 있으면 그쪽에 ‹ › 화살표를 보여준다.
 * 화살표를 누르면 한 화면만큼 넘어간다.
 */
export default function LineScroller({ label, className, arriving, onReady, focus = false, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [measure])

  // 새 옷이 걸린 줄: 화면을 그 줄로 내리고, 줄을 오른쪽 끝까지 넘긴 다음 애니메이션을 시작한다
  const readyRef = useRef(onReady)
  useEffect(() => {
    readyRef.current = onReady
  })
  useEffect(() => {
    if (!arriving) return
    const el = box.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (focus) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    const item = el.querySelector<HTMLElement>(`[data-hung-id="${arriving}"]`)
    // 그 옷의 오른쪽 끝이 화면 안에 들어오게(오른쪽에 조금 여유). 새 옷이면 줄 맨 끝까지 넘어간다.
    const want = item ? Math.min(el.scrollWidth - el.clientWidth, Math.max(0, item.offsetLeft + item.offsetWidth + 24 - el.clientWidth)) : el.scrollWidth
    // 멀리(두 화면 넘게) 넘겨야 하면 부드럽게 굴리지 않고 바로 간다: 옷이 많을 때 렉이 걸려 중간에 멈추는 걸 막는다
    const instant = reduce || Math.abs(want - el.scrollLeft) > el.clientWidth * 2
    if (Math.abs(want - el.scrollLeft) > 4) el.scrollTo({ left: want, behavior: instant ? 'auto' : 'smooth' })
    const t = window.setTimeout(() => readyRef.current?.(), instant ? 0 : SCROLL_MS)
    return () => window.clearTimeout(t)
  }, [arriving, focus])

  const page = (dir: 1 | -1) => {
    const el = box.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className="cline-wrap">
      <div ref={box} className="cline-scroll" tabIndex={0} aria-label={label} onScroll={measure}>
        <div className={className}>{children}</div>
      </div>
      {edge.left && (
        <button type="button" className="cline-arrow left" aria-label={`${label} 앞쪽 옷 보기`} onClick={() => page(-1)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15.5 4.5 Q10.5 9 7.8 12.2 Q11 15.2 15.2 19.6" />
          </svg>
        </button>
      )}
      {edge.right && (
        <button type="button" className="cline-arrow right" aria-label={`${label} 뒤쪽 옷 더 보기`} onClick={() => page(1)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M8.5 4.5 Q13.5 9 16.2 12.2 Q13 15.2 8.8 19.6" />
          </svg>
        </button>
      )}
    </div>
  )
}
