import { useEffect, useId, useState } from 'react'
import FigureArt, { type Face } from './FigureArt'
import { buildPose } from './greetingPose'
import { figureSvgProps } from './figureProps'

// '大' 자로 서서 웃고 있던 졸라맨이, 기분이 상하면(mood) 무표정 -> 울음으로 바뀌며 팔이 축 늘어지고 고개를 떨군다.
const ARM_OPEN = 58 // 팔을 벌린 각도(IntroFigure 와 같음)
const ARM_DOWN = 9 // 축 늘어뜨린 각도
const DROOP_MS = 750

const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)

export default function ReactFigure({ mood, size = 150 }: { mood: Face; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const sad = mood !== 'smile'
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [tween, setTween] = useState(0) // 0: 서 있음 -> 1: 축 처짐
  const e = !sad ? 0 : reduced ? 1 : tween

  useEffect(() => {
    if (!sad || reduced) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / DROOP_MS)
      setTween(easeOutCubic(u))
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sad, reduced])

  const arm = lerp(ARM_OPEN, ARM_DOWN, e)
  const pose = buildPose(arm, arm)
  return (
    <svg className={`doodle react-figure${mood === 'cry' ? ' sob' : ''}`} width={size} height={size * 1.15} {...figureSvgProps}>
      <FigureArt pose={pose} id={`${uid}r`} face={mood} tilt={9 * e} dy={3 * e} />
    </svg>
  )
}
