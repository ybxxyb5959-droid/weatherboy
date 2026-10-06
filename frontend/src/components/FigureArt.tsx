import type { Pose } from './greetingPose'

export type Reg = (key: string) => (el: SVGGeometryElement | null) => void
export type Face = 'smile' | 'flat' | 'cry'

/** 표정: 웃음 / 무표정(-_-) / 울음(ㅠㅠ). 눈과 입 위치는 머리 안쪽 좌표 */
function FaceArt({ face }: { face: Face }) {
  if (face === 'flat')
    return (
      <g strokeWidth="2.4">
        <path d="M49.5 30 L57.5 30" />
        <path d="M62.5 29.5 L70.5 29.5" />
        <path d="M56 38.5 L65 38.5" strokeWidth="2" />
      </g>
    )
  // 울음: 눈은 ㅠ 모양, 입은 떨리는 ㅅ자, 눈물이 주르륵
  return (
    <g strokeWidth="2.2">
      <path d="M49.5 28.5 H57.5 M51.5 28.5 V33.5 M55.5 28.5 V33.5" />
      <path d="M62.5 28 H70.5 M64.5 28 V33 M68.5 28 V33" />
      <path d="M55.5 40 Q58 36.8 60.5 39.5 Q63 36.8 65.5 40" strokeWidth="2" />
      <g stroke="#5aa0d8" strokeWidth="2.2" className="tears">
        <path className="tear" d="M51.5 35 V47" />
        <path className="tear t2" d="M55.5 35 V47" />
        <path className="tear t3" d="M64.5 34.5 V46.5" />
        <path className="tear t4" d="M68.5 34.5 V46.5" />
      </g>
    </g>
  )
}

/**
 * 한 자세의 졸라맨 그림. reg 가 있으면 그리는 중(획마다 요소를 등록), 없으면 완성된 그림.
 * face 를 주면 표정을 바꾸고, tilt/dy 로 고개를 기울이거나 숙인다.
 */
export default function FigureArt({ pose, id, reg, face, tilt = 0, dy = 0 }: { pose: Pose; id: string; reg?: Reg; face?: Face; tilt?: number; dy?: number }) {
  const r = (k: string) => reg?.(k)
  const headMove = tilt || dy ? `translate(0 ${dy}) rotate(${tilt} 60 47)` : undefined
  return (
    <g transform="translate(10 0)">
      <clipPath id={`${id}-pants`}>
        <path d={pose.pants} />
      </clipPath>
      <g transform={headMove}>
        <path ref={r('head')} d={pose.head} />
        {face && face !== 'smile' ? (
          <FaceArt face={face} />
        ) : (
          <>
            <circle ref={r('eyeL')} cx={pose.eyes[0]![0]} cy={pose.eyes[0]![1]} r="1.9" fill="var(--ink)" stroke="none" />
            <circle ref={r('eyeR')} cx={pose.eyes[1]![0]} cy={pose.eyes[1]![1]} r="1.9" fill="var(--ink)" stroke="none" />
            <path ref={r('smile')} d={pose.smile} strokeWidth="2" />
          </>
        )}
      </g>
      <path ref={r('body')} d={pose.body} />
      <path ref={r('armL')} d={pose.armL} />
      <circle ref={r('handL')} cx={pose.handL[0]} cy={pose.handL[1]} r="3.4" fill="var(--paper)" strokeWidth="2.2" />
      <path ref={r('armR')} d={pose.armR} />
      <circle ref={r('handR')} cx={pose.handR[0]} cy={pose.handR[1]} r="3.4" fill="var(--paper)" strokeWidth="2.2" />
      <path ref={r('legL')} d={pose.legL} />
      <path ref={r('legR')} d={pose.legR} />
      <path ref={r('pants')} d={pose.pants} fill={pose.pantsFill} strokeWidth="3.6" />
      {reg && (
        <g clipPath={`url(#${id}-pants)`}>
          <path ref={r('hatch')} d={pose.hatch} stroke={pose.pantsFill} strokeWidth="5.5" />
        </g>
      )}
      <path ref={r('waist')} d={pose.pantsWaist} stroke="#d6d6d6" strokeWidth="1.8" />
      <path ref={r('tee')} d={pose.tee} fill={pose.teeFill} strokeWidth="3.4" />
      <path ref={r('neck')} d={pose.teeNeck} strokeWidth="1.8" />
    </g>
  )
}
