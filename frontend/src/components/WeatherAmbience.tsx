import type { CSSProperties } from 'react'
import type { WeatherKind } from './DoodleWeather'

type Layer = 'rain' | 'drizzle' | 'flash' | 'snow' | 'sun' | 'clouds' | 'fog' | 'gust' | 'dust' | 'stars' | 'sparkle' | 'ripple'

// 날씨마다 겹쳐 보여줄 배경 효과. 홈의 날씨 카드 뒤에서 아주 은은하게 움직인다.
const LAYERS: Record<WeatherKind, Layer[]> = {
  clear: ['sun'],
  uv: ['sun'],
  heat: ['sun'],
  partly: ['sun', 'clouds'],
  range: ['clouds'],
  cloudy: ['clouds'],
  rain: ['rain', 'ripple'],
  shower: ['rain', 'ripple'],
  thunder: ['rain', 'flash', 'ripple'],
  snow: ['snow'],
  sleet: ['drizzle', 'snow'],
  windy: ['gust'],
  typhoon: ['rain', 'gust'],
  fog: ['fog'],
  dust: ['dust'],
  night: ['stars'],
  partlynight: ['stars', 'clouds'],
  cold: ['sparkle', 'snow'],
  frost: ['sparkle'],
}

// 같은 입력이면 항상 같은 모양(렌더링마다 흔들리지 않도록 무작위 대신 계산으로 흩뿌린다)
const at = (i: number, k: number, mod = 97) => ((i * k + 7) % mod) + 1
const style = (v: Record<string, string | number>) => v as CSSProperties
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const SUN_RAYS = range(16).map((i) => {
  const a = (i * Math.PI * 2) / 16
  const r1 = 58
  const r2 = i % 2 ? 80 : 92
  return `M${100 + Math.cos(a) * r1} ${100 + Math.sin(a) * r1} L${100 + Math.cos(a) * r2} ${100 + Math.sin(a) * r2}`
}).join(' ')

const CLOUD = 'M16 38 C5 38 4 24 15 23 C15 11 32 8 38 18 C48 12 60 22 53 31 C60 33 56 39 50 38 Z'

/**
 * 홈 날씨 카드 뒤의 움직이는 배경(비가 내리고, 눈이 날리고, 햇살이 돌고, 구름이 흘러가요).
 * 클릭을 가로채지 않고(pointer-events: none) 스크린리더에도 숨긴다. 움직임 줄이기 설정이면 멈춘다(motion.css).
 */
export default function WeatherAmbience({ kind }: { kind: WeatherKind }) {
  const layers = LAYERS[kind] ?? []
  if (layers.length === 0) return null
  return (
    <div className={`wx-amb k-${kind}`} aria-hidden="true">
      {layers.includes('sun') && (
        <>
          <i className="sun-glow" />
          <svg className="sun-burst" viewBox="0 0 200 200" fill="none" stroke="#e8a24a" strokeWidth="3" strokeLinecap="round">
            <path d={SUN_RAYS} />
          </svg>
        </>
      )}
      {layers.includes('clouds') &&
        range(3).map((i) => (
          <svg key={i} className="cloud" viewBox="0 0 64 44" style={style({ '--top': `${8 + i * 24}%`, '--t': `${46 + i * 17}s`, '--d': `${-i * 15}s`, '--s': 0.8 + i * 0.25 })} fill="#fcfcfa" stroke="#222" strokeWidth="2.2" strokeLinejoin="round">
            <path d={CLOUD} />
          </svg>
        ))}
      {(layers.includes('rain') || layers.includes('drizzle')) &&
        range(layers.includes('drizzle') ? 9 : 18).map((i) => (
          <i key={i} className="rain" style={style({ '--l': `${at(i, 17)}%`, '--d': `${-((i * 0.41) % 1.6).toFixed(2)}s`, '--t': `${(0.8 + (i % 4) * 0.13).toFixed(2)}s`, '--h': `${12 + (i % 3) * 5}px`, '--o': 0.5 + (i % 3) * 0.17 })} />
        ))}
      {layers.includes('ripple') &&
        range(3).map((i) => <b key={i} className="ripple" style={style({ '--l': `${18 + i * 30}%`, '--d': `${-i * 0.9}s` })} />)}
      {layers.includes('flash') && <i className="flash" />}
      {layers.includes('snow') &&
        range(14).map((i) => (
          <i key={i} className="flake" style={style({ '--l': `${at(i, 23)}%`, '--s': `${5 + (i % 3) * 2}px`, '--d': `${-((i * 0.9) % 6).toFixed(1)}s`, '--t': `${(5.5 + (i % 4) * 1.2).toFixed(1)}s` })} />
        ))}
      {layers.includes('fog') &&
        range(3).map((i) => (
          <svg key={i} className="fogband" viewBox="0 0 200 20" preserveAspectRatio="none" style={style({ '--top': `${18 + i * 26}%`, '--t': `${16 + i * 6}s`, '--d': `${-i * 5}s` })} fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round">
            <path d="M0 10 Q25 2 50 10 T100 10 T150 10 T200 10" />
          </svg>
        ))}
      {layers.includes('gust') &&
        range(6).map((i) => (
          <svg key={i} className="gust" viewBox="0 0 70 14" style={style({ '--top': `${10 + i * 15}%`, '--w': `${40 + (i % 3) * 18}px`, '--t': `${(1.9 + (i % 3) * 0.5).toFixed(1)}s`, '--d': `${-((i * 0.7) % 3).toFixed(1)}s` })} fill="none" stroke="#222" strokeWidth="2.2" strokeLinecap="round">
            <path d="M2 8 H48 C58 8 60 2 54 2" />
          </svg>
        ))}
      {layers.includes('dust') &&
        range(16).map((i) => (
          <i key={i} className="speck" style={style({ '--l': `${at(i, 29)}%`, '--top': `${at(i, 13)}%`, '--s': `${3 + (i % 3)}px`, '--d': `${-((i * 1.3) % 8).toFixed(1)}s`, '--t': `${(7 + (i % 4) * 2).toFixed(0)}s` })} />
        ))}
      {(layers.includes('stars') || layers.includes('sparkle')) &&
        range(14).map((i) => (
          <i key={i} className="star" style={style({ '--l': `${at(i, 31)}%`, '--top': `${at(i, 19) % 90}%`, '--s': `${3 + (i % 3)}px`, '--d': `${-((i * 0.6) % 3).toFixed(1)}s` })} />
        ))}
    </div>
  )
}
