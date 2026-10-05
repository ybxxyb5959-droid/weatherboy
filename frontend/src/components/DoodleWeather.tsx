import type { ReactNode } from 'react'

const common = {
  fill: 'none',
  stroke: '#222',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'doodle',
  'aria-hidden': true,
}
// animate=true 면 움직이는 그림: 움직이는 부분에 wx-* 클래스가 붙고, 움직임 자체는 styles/motion.css 가 정한다(움직임 줄이기 설정이면 멈춘다).
const cls = (animate: boolean) => (animate ? 'doodle wx' : 'doodle')

export function Cloud({ size = 56, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size * 0.66} viewBox="0 0 60 40" {...common} className={cls(animate)}>
      <path d="M14 33 C4 33 3 20 13 19 C13 8 28 5 33 14 C42 8 54 16 48 26 C56 28 52 34 46 33 Z" />
    </svg>
  )
}

export function Sun({ size = 50, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" {...common} className={cls(animate)}>
      <path className="wx-sunbody" d="M25 14 C33 13 37 22 35 28 C32 36 20 37 15 30 C12 22 17 15 25 14Z" fill="#f2cf4a" />
      <path d="M21 25 l.1 0 M29 25 l.1 0" strokeWidth="3.2" />
      <path d="M22 29.5 Q25 33 28 29.5" strokeWidth="1.8" />
      <path className="wx-rays" d="M25 3 L25 8 M25 42 L26 47 M3 25 L8 25 M42 24 L47 25 M9 9 L13 13 M37 37 L41 41 M41 9 L37 13 M9 41 L13 37" />
    </svg>
  )
}

export function Flower({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 36 50" {...common}>
      <path d="M18 24 C17 34 20 42 18 49" />
      <path d="M18 38 Q10 34 8 40 Q14 42 18 38" stroke="#5aa86a" />
      <circle cx="18" cy="14" r="3" fill="#f2cf4a" />
      <path d="M18 11 C14 2 8 8 13 13 M21 14 C30 12 29 20 21 17 M17 17 C12 24 20 26 20 18 M15 13 C6 14 8 22 15 16" />
    </svg>
  )
}

export function Bee({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 40 32" {...common}>
      <ellipse cx="20" cy="19" rx="11" ry="8" fill="#f2cf4a" />
      <path d="M16 12 L15 26 M23 12 L24 26" strokeWidth="2.4" />
      <path className="wing" d="M14 12 C10 2 20 0 20 11 M22 11 C24 1 33 4 26 13" />
      <path d="M31 19 l5 0 M9 18 l-3 -2" strokeWidth="1.8" />
    </svg>
  )
}

export type WeatherKind =
  | 'clear'
  | 'cloudy'
  | 'partly'
  | 'rain'
  | 'thunder'
  | 'snow'
  | 'windy'
  | 'dust'
  | 'fog'
  | 'heat'
  | 'cold'
  | 'shower'
  | 'sleet'
  | 'range'
  | 'uv'
  | 'frost'
  | 'typhoon'
  | 'night'
  | 'partlynight'

export const weatherKinds: { kind: WeatherKind; label: string }[] = [
  { kind: 'clear', label: '맑음' },
  { kind: 'cloudy', label: '흐림' },
  { kind: 'partly', label: '구름 조금' },
  { kind: 'rain', label: '비' },
  { kind: 'thunder', label: '번개' },
  { kind: 'snow', label: '눈' },
  { kind: 'windy', label: '바람 센 날' },
  { kind: 'dust', label: '미세먼지' },
  { kind: 'fog', label: '안개' },
  { kind: 'heat', label: '폭염' },
  { kind: 'cold', label: '한파' },
  { kind: 'shower', label: '소나기' },
  { kind: 'sleet', label: '진눈깨비' },
  { kind: 'range', label: '일교차 큰 날' },
  { kind: 'uv', label: '자외선 강함' },
  { kind: 'frost', label: '빙판·서리' },
  { kind: 'typhoon', label: '태풍' },
  { kind: 'night', label: '밤' },
  { kind: 'partlynight', label: '구름 조금(밤)' },
]

const CLOUD = 'M16 38 C5 38 4 24 15 23 C15 11 32 8 38 18 C48 12 60 22 53 31 C60 33 56 39 50 38 Z'
const PAPER = '#fcfcfa'

const wrap = (size: number, kind: string, children: ReactNode, animate = false) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...common} className={cls(animate)} aria-label={kind} role="img">
    {children}
  </svg>
)

// 옷차림에 영향이 큰 특수 날씨들
function extraWeather(kind: WeatherKind, size: number, animate: boolean): ReactNode | null {
  switch (kind) {
    case 'dust':
      return wrap(
        size,
        kind,
        <g>
          {/* 마스크 쓴 얼굴 */}
          <path d="M32 12 C45 11 50 24 47 33 C43 45 21 46 17 34 C13 22 20 13 32 12Z" fill={PAPER} />
          <path d="M25 24 l.1 0 M39 24 l.1 0" strokeWidth="3" />
          <path d="M18 31 Q32 27 46 31 L43 45 Q32 51 21 45Z" fill={PAPER} />
          <path d="M18 31 L12 28 M46 31 L52 28" strokeWidth="1.6" />
          <path d="M23 36 H41 M23 40 H41" strokeWidth="1.4" />
          {/* 미세먼지 알갱이 */}
          <g stroke="#b8975a">
            <path className="wx-float-a" d="M6 8 l.1 0 M13 4 l.1 0 M54 6 l.1 0 M59 14 l.1 0 M5 20 l.1 0 M58 40 l.1 0 M8 50 l.1 0 M52 54 l.1 0" strokeWidth="3.4" />
            <path className="wx-float-b" d="M3 34 l.1 0 M60 28 l.1 0 M16 58 l.1 0 M44 60 l.1 0 M22 6 l.1 0 M48 12 l.1 0" strokeWidth="2" />
            <path className="wx-drift" d="M2 44 Q6 41 10 44 M52 46 Q56 43 60 46" strokeWidth="1.4" />
          </g>
        </g>,
        animate,
      )
    case 'fog':
      return wrap(
        size,
        kind,
        <g>
          <g transform="translate(0 -12)">
            <path className="wx-drift" d={CLOUD} fill={PAPER} />
          </g>
          <path className="wx-drift" d="M8 34 Q16 31 24 34 T40 34 T56 34" />
          <path className="wx-drift wx-slow" d="M14 43 Q22 40 30 43 T46 43 T58 42" />
          <path className="wx-drift wx-rev" d="M6 52 Q14 49 22 52 T38 52 T52 51" />
        </g>,
        animate,
      )
    case 'heat':
      return wrap(
        size,
        kind,
        <g>
          <g className="wx-pulse" style={{ transformOrigin: '27px 24px' }}>
            <path d="M26 12 C38 10 44 22 41 31 C37 41 20 42 14 32 C9 22 16 13 26 12Z" fill="#f2cf4a" />
            <path d="M20 24 l.1 0 M32 23 l.1 0" strokeWidth="2.8" />
            <path d="M22 31 Q26 36 31 31 Q26 33 22 31Z" strokeWidth="1.6" />
          </g>
          <path className="wx-rays" style={{ transformOrigin: '27px 22px' }} d="M27 2 V7 M5 22 H10 M9 6 L13 10 M45 6 L41 10 M46 22 H51 M12 40 L16 36" strokeWidth="2" />
          <path className="wx-drop" d="M47 14 C45 18 44 20 47 22 C50 20 49 18 47 14Z" fill="#4aa6a0" strokeWidth="1.2" />
          <path d="M53 30 V54 M59 30 V54 M53 30 Q56 26 59 30 M53 54 C48 58 50 64 56 63 C62 64 64 58 59 54" fill={PAPER} />
          <path d="M56 40 V58" stroke="#e8a24a" strokeWidth="3" />
        </g>,
        animate,
      )
    case 'cold':
      return wrap(
        size,
        kind,
        <g>
          <path d="M14 8 V38 M22 8 V38 M14 8 Q18 3 22 8 M14 38 C8 42 10 52 18 52 C26 52 28 42 22 38" fill={PAPER} />
          <path d="M18 40 V50" stroke="#4aa6a0" strokeWidth="3.2" />
          <path d="M18 24 H22 M18 16 H22" strokeWidth="1.4" />
          <g className="wx-spin-slow" style={{ transformOrigin: '44px 29px' }}>
            <path d="M44 8 V50 M26 29 H62 M31 15 L57 43 M57 15 L31 43" strokeWidth="1.8" />
            <path d="M44 14 l-4 -3 M44 14 l4 -3 M44 44 l-4 3 M44 44 l4 3 M30 29 l3 -4 M30 29 l3 4 M58 29 l-3 -4 M58 29 l-3 4" strokeWidth="1.4" />
          </g>
        </g>,
        animate,
      )
    case 'sleet':
      return wrap(
        size,
        kind,
        <g transform="translate(0 -6)">
          <path d={CLOUD} fill={PAPER} />
          <path className="wx-fall" d="M18 44 l-3 8" stroke="#4aa6a0" strokeWidth="2.2" />
          <path className="wx-fall wx-d2" d="M38 44 l-3 8" stroke="#4aa6a0" strokeWidth="2.2" />
          <g strokeWidth="1.6">
            <path className="wx-fall wx-d1" d="M28 46 v7 M25 47.5 l6 3 M31 47.5 l-6 3" />
            <path className="wx-fall wx-d3" d="M48 45 v7 M45 46.5 l6 3 M51 46.5 l-6 3" />
          </g>
        </g>,
        animate,
      )
    case 'range':
      return wrap(
        size,
        kind,
        <g>
          <path d="M18 6 C26 5 30 13 27 19 C24 25 13 25 10 19 C7 13 11 7 18 6Z" fill="#f2cf4a" />
          <path d="M18 0 V3 M3 14 H6 M7 3 L9 5 M30 3 L28 5" strokeWidth="1.8" />
          <path d="M52 38 C40 38 36 50 44 58 C34 58 28 48 34 40 C38 34 46 34 52 38Z" fill="#f2cf4a" />
          <path d="M56 28 l.1 0 M60 40 l.1 0" strokeWidth="2.4" />
          <path d="M24 30 Q36 28 40 26" strokeDasharray="3 4" strokeWidth="1.8" />
          <path className="wx-bob" d="M26 38 Q22 46 30 52 M30 52 l-5 -1 M30 52 l1 -5" strokeWidth="1.8" />
        </g>,
        animate,
      )
    case 'uv':
      return wrap(
        size,
        kind,
        <g>
          <path d="M32 14 C44 12 50 24 47 34 C43 45 24 46 18 35 C13 24 20 15 32 14Z" fill="#f2cf4a" />
          <path d="M20 26 C20 22 30 22 31 26 C31 31 21 31 20 26Z M34 26 C34 22 44 22 44 26 C43 31 35 31 34 26Z" fill="#222" strokeWidth="1.6" />
          <path d="M31 25 H34" strokeWidth="1.6" />
          <path d="M28 36 Q33 40 38 35" strokeWidth="1.8" />
          <path className="wx-rays" style={{ transformOrigin: '32px 30px' }} d="M32 2 V9 M6 28 H13 M52 28 H58 M12 8 L17 13 M52 8 L47 13 M12 48 L17 43 M52 48 L47 43 M32 52 V58" strokeWidth="2.4" stroke="#e8a24a" />
        </g>,
        animate,
      )
    case 'frost':
      return wrap(
        size,
        kind,
        <g>
          <path d="M6 40 L18 28 L58 30 L52 48 L10 50Z" fill="#cfe6e2" />
          <path d="M22 36 L30 32 M36 40 L46 36 M16 44 L26 43" strokeWidth="1.6" />
          <path d="M30 36 L36 42 L33 47 M36 42 L44 44" strokeWidth="1.3" />
          <path className="wx-twinkle" d="M44 22 l.1 0 M52 18 l.1 0" strokeWidth="2.6" />
          <path d="M14 6 L26 6 L20 18Z M20 9 V13 M20 15 l.1 0" fill={PAPER} strokeWidth="1.8" />
        </g>,
        animate,
      )
    case 'typhoon':
      return wrap(
        size,
        kind,
        <g>
          <path className="wx-spin-slow" style={{ transformOrigin: '32px 32px' }} d="M33.5 32.0 L33.8 32.4 L34.1 33.0 L34.1 33.6 L33.9 34.3 L33.6 35.1 L32.9 35.7 L32.1 36.2 L31.1 36.5 L30.0 36.6 L28.9 36.3 L27.7 35.8 L26.6 34.9 L25.8 33.8 L25.1 32.4 L24.8 30.9 L24.9 29.2 L25.3 27.5 L26.2 25.9 L27.5 24.4 L29.2 23.3 L31.1 22.5 L33.2 22.1 L35.5 22.3 L37.8 22.9 L39.9 24.1 L41.7 25.8 L43.2 28.0 L44.2 30.5 L44.6 33.2 L44.4 36.0 L43.6 38.8 L42.1 41.5 L40.0 43.7 L37.4 45.6 L34.3 46.8 L31.0 47.3 L27.6 47.1 L24.2 46.1 L21.1 44.4 L18.3 41.9 L16.1 38.9 L14.6 35.3 L14.0 31.4 L14.1 27.4 L15.2 23.5 L17.2 19.8 L20.0 16.5 L23.5 13.9 L27.6 12.1 L32.0 11.3 L36.6 11.4 L41.2 12.5 L45.4 14.7 L49.2 17.8 L52.2 21.7 L54.3 26.3 L55.4 31.3 L55.4 36.5 L54.2 41.6 L51.9 46.5" />
          <path className="wx-drift" d="M6 12 H20 C25 12 25 6 20 6 M44 58 H58 C63 58 63 52 58 52" strokeWidth="2" />
          <path className="wx-drift wx-rev" d="M8 56 l4 -4 M52 8 l4 -4" strokeWidth="1.8" />
        </g>,
        animate,
      )
    case 'night':
      return wrap(
        size,
        kind,
        <g>
          <path className="wx-bob" d="M40 8 C26 8 16 20 18 34 C20 48 36 56 48 48 C34 48 28 36 32 24 C34 17 38 11 40 8Z" fill="#f2cf4a" />
          <path d="M26 30 l4 1 M24 40 l4 1" strokeWidth="2" />
          <path d="M31 46 Q33 48 36 47" strokeWidth="1.6" />
          <g strokeWidth="1.6">
            <path className="wx-twinkle" d="M50 12 v7 M46.5 13.5 l7 4 M53.5 13.5 l-7 4" />
            <path className="wx-twinkle wx-d2" d="M54 34 v5 M51.5 35.5 l5 2 M56.5 35.5 l-5 2" />
          </g>
          <path className="wx-twinkle wx-d1" d="M10 10 l.1 0 M56 54 l.1 0 M8 52 l.1 0" strokeWidth="2.6" />
        </g>,
        animate,
      )
    case 'partlynight':
      // 해가 진 뒤의 "구름 조금": 구름 뒤에서 달이 빼꼼
      return wrap(
        size,
        kind,
        <g>
          <g transform="translate(-8 -6) scale(0.62)">
            <path className="wx-bob" d="M40 8 C26 8 16 20 18 34 C20 48 36 56 48 48 C34 48 28 36 32 24 C34 17 38 11 40 8Z" fill="#f2cf4a" />
            <path d="M26 30 l4 1 M24 40 l4 1" strokeWidth="2.6" />
          </g>
          <path className="wx-twinkle" d="M50 9 v7 M46.5 12.5 h7" strokeWidth="1.6" />
          <path className="wx-twinkle wx-d2" d="M58 24 l.1 0 M38 4 l.1 0" strokeWidth="2.6" />
          <g transform="translate(2 6)">
            <g className="wx-drift">
              <path d={CLOUD} fill={PAPER} />
            </g>
          </g>
        </g>,
        animate,
      )
    default:
      return null
  }
}

export function WeatherDoodle({ kind, size = 80, animate = false }: { kind: WeatherKind; size?: number; animate?: boolean }) {
  if (kind === 'clear') return <Sun size={size} animate={animate} />
  const extra = extraWeather(kind, size, animate)
  if (extra) return extra
  if (kind === 'snow') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" {...common} className={cls(animate)} aria-label="눈" role="img">
        {/* 눈사람 */}
        <path d="M32 33 C45 32 49 46 43 54 C38 62 24 62 20 54 C15 46 20 33 32 33Z" fill={PAPER} />
        <path d="M32 18 C40 17 42 26 39 31 C36 36 27 36 24 31 C21 25 25 18 32 18Z" fill={PAPER} />
        <path d="M28 25 l.1 0 M36 25 l.1 0" strokeWidth="2.6" />
        <path d="M32 28 l6 1.5 l-6 1Z" fill="#e8a24a" strokeWidth="1.2" />
        <path d="M32 40 l.1 0 M32 47 l.1 0" strokeWidth="3" />
        <path d="M21 41 L10 34 M10 34 l-3 -3 M10 34 l-4 1 M43 41 L54 34 M54 34 l3 -3 M54 34 l4 1" strokeWidth="1.8" />
        <path d="M24 18 L40 17 M27 17 L28 9 L37 9 L38 17" strokeWidth="1.8" />
        {/* 내리는 눈 */}
        <g strokeWidth="1.5">
          <path className="wx-snowfall" d="M8 8 v6 M5 9.5 l6 3 M11 9.5 l-6 3" />
          <path className="wx-snowfall wx-d2" d="M52 6 v6 M49 7.5 l6 3 M55 7.5 l-6 3" />
          <path className="wx-snowfall wx-d1" d="M56 22 v5 M53.5 23.5 l5 2 M58.5 23.5 l-5 2" />
          <path className="wx-snowfall wx-d3" d="M6 26 v5 M3.5 27.5 l5 2 M8.5 27.5 l-5 2" />
          <path className="wx-twinkle" d="M15 52 l.1 0 M50 58 l.1 0 M58 48 l.1 0 M4 58 l.1 0 M46 14 l.1 0 M18 12 l.1 0" strokeWidth="2.6" />
        </g>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...common} className={cls(animate)} aria-label={kind} role="img" overflow="visible">
      {(kind === 'partly' || kind === 'shower') && (
        <g>
          <path className="wx-sunbody" d="M18 8 C27 6 32 15 29 22 C25 30 12 30 8 22 C5 14 10 9 18 8Z" fill="#f2cf4a" />
          <path d="M13 17 l.1 0 M22 16 l.1 0" strokeWidth="2.6" />
          <path d="M15 22 Q18 25 21 22" strokeWidth="1.6" />
          {/* 햇살은 해 둘레 8방향. 돌리면 구름 뒤로 숨거나 그림 밖으로 잘려 해가 대머리처럼 보여서, 제자리에서 숨 쉬듯 커졌다 작아진다 */}
          <path className="wx-pulse" style={{ transformOrigin: '18px 15px' }} d="M33 15 H37 M28.6 25.6 L31.4 28.4 M18 30 V34 M7.4 25.6 L4.6 28.4 M3 15 H-1 M7.4 4.4 L4.6 1.6 M18 0 V-4 M28.6 4.4 L31.4 1.6" strokeWidth="2" />
        </g>
      )}
      {kind === 'windy' ? (
        <g>
          <path className="wx-wind" d="M5 20 H38 C49 20 50 8 41 9" />
          <path className="wx-wind wx-d2" d="M5 33 H50 C61 33 61 46 51 44" />
          <path className="wx-wind wx-d1" d="M10 46 H30 C37 46 37 55 30 54" />
          <path d="M44 56 l6 -2 l-2 6" strokeWidth="1.6" />
        </g>
      ) : (
        <g transform={kind === 'partly' || kind === 'shower' ? 'translate(2 6)' : kind === 'cloudy' ? 'translate(0 6)' : 'translate(0 -6)'}>
          {kind === 'cloudy' && (
            <g className="wx-drift wx-rev">
              <path d={CLOUD} fill={PAPER} transform="translate(16 -4) scale(0.8)" />
            </g>
          )}
          <g className={kind === 'cloudy' || kind === 'partly' ? 'wx-drift' : 'wx-bob'}>
            <path d={CLOUD} fill={PAPER} />
          </g>
          {(kind === 'rain' || kind === 'shower') && (
            <g stroke="#4aa6a0" strokeWidth="2.2">
              <path className="wx-fall" d="M18 44 l-3 8" />
              <path className="wx-fall wx-d1" d="M28 44 l-3 8" />
              <path className="wx-fall wx-d2" d="M38 44 l-3 8" />
              <path className="wx-fall wx-d3" d="M48 44 l-3 8" />
            </g>
          )}
          {kind === 'thunder' && <path className="wx-bolt" d="M35 40 L26 53 L34 53 L29 64 L44 47 L35 47 L40 40Z" fill="#f2cf4a" />}
        </g>
      )}
    </svg>
  )
}
