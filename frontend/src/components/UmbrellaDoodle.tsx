export default function UmbrellaDoodle({ size = 86 }: { size?: number }) {
  return (
    <svg className="doodle" width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="#222" strokeWidth="2.4" strokeLinecap="round" aria-label="우산" role="img">
      <path d="M10 52 Q50 -10 90 52 Q80 45 70 52 Q60 45 50 52 Q40 45 30 52 Q20 45 10 52Z" fill="#cfe6e2" />
      <path d="M50 52 V84 Q50 92 42 90" />
    </svg>
  )
}
