import { useState, type ReactNode } from 'react'
import { pct } from './format'

// ───── 부품 ─────
export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warn' | 'good' }) {
  return (
    <div className={`box w1 admin-stat${tone ? ` ${tone}` : ''}`}>
      <div className="tiny">{label}</div>
      <b>{value}</b>
      {sub && <div className="tiny">{sub}</div>}
    </div>
  )
}

export function Card({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`adm-card ${className}`.trim()}>
      <div className="adm-card-head">
        <h2>{title}</h2>
        {right && <div className="adm-card-right">{right}</div>}
      </div>
      {children}
    </section>
  )
}

export function Bars({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="adm-bars">
      {rows.map((r) => (
        <div key={r.label} className="adm-bar">
          <span className="lbl">{r.label}</span>
          <span className="track">
            <i style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }} />
          </span>
          <span className="val">
            {r.value}
            {total ? <small> ({pct(r.value, total)})</small> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 일별 막대 그래프(날짜 라벨은 5개 안팎만 보여 준다) */
export function DayBars({ rows, label }: { rows: { d: string; v: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  const step = Math.ceil(rows.length / 7)
  return (
    <figure className="adm-daybars" aria-label={label}>
      <div className="cols">
        {rows.map((r) => (
          <div key={r.d} className="col" title={`${r.d.slice(5).replace('-', '/')} · ${r.v}`}>
            <span className="num">{r.v || ''}</span>
            <i style={{ height: `${Math.max(r.v ? 4 : 0, (r.v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="axis">
        {rows.map((r, i) => (
          <span key={r.d}>{i % step === 0 || i === rows.length - 1 ? r.d.slice(5).replace('-', '/') : ''}</span>
        ))}
      </div>
    </figure>
  )
}

/** 최근 N일(한국 날짜) 꺾은선: 값이 없는 날은 0 으로 채운다 */
export function LineChart({ rows, days = 7, label }: { rows: { d: string; c: number }[]; days?: number; label: string }) {
  const byDay = new Map(rows.map((r) => [r.d, r.c]))
  const [now] = useState(() => Date.now()) // 화면을 연 시점의 한국 날짜 기준
  const kstNow = now + 9 * 3600_000
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(kstNow - (days - 1 - i) * 86400_000).toISOString().slice(0, 10)
    return { d, c: byDay.get(d) ?? 0 }
  })
  const W = 520
  const H = 200
  const L = 30
  const R = 22
  const T = 24
  const B = 30
  const max = Math.max(4, ...list.map((x) => x.c))
  const x = (i: number) => L + ((W - L - R) * i) / (list.length - 1)
  const y = (c: number) => T + (H - T - B) * (1 - c / max)
  const pts = list.map((p, i) => `${x(i)},${y(p.c)}`).join(' ')
  const total = list.reduce((a, p) => a + p.c, 0)
  const step = Math.ceil(list.length / 8)
  return (
    <figure className="admin-chart" aria-label={`${label} ${total}명`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <path d={`M${L} ${y(max * f)} H${W - R}`} stroke="#222" strokeOpacity="0.18" strokeDasharray="4 4" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="12" fill="#222" opacity="0.7">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <g className="doodle" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={pts} />
          {list.map((p, i) => (
            <circle key={p.d} cx={x(i)} cy={y(p.c)} r="3.6" fill="#fcfcfa" />
          ))}
        </g>
        {list.map((p, i) =>
          p.c > 0 ? (
            <text key={p.d} x={x(i)} y={y(p.c) - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill="#222">
              {p.c}
            </text>
          ) : null,
        )}
        {list.map((p, i) =>
          i % step === 0 || i === list.length - 1 ? (
            <text key={p.d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#222" opacity="0.75">
              {p.d.slice(5).replace('-', '/')}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="tiny">
        {days}일 합계 {total}명
      </figcaption>
    </figure>
  )
}

/** ok: 정상(초록 ✓), 아니면 확인 필요(빨강 !). optional 이고 꺼져 있으면 회색 "-" */
export function Dot({ ok, optional = false }: { ok: boolean; optional?: boolean }) {
  const off = !ok && optional
  return (
    <span className={`adm-dot ${ok ? 'ok' : off ? 'off' : 'bad'}`} role="img" aria-label={ok ? '정상' : off ? '꺼짐(선택)' : '확인 필요'}>
      {ok ? '✓' : off ? '-' : '!'}
    </span>
  )
}
