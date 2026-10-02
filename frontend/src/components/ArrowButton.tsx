/** 달력의 이전/다음 달 화살표: 테두리 없이 손으로 쓱 그은 낙서 화살표만 보인다. */
export default function ArrowButton({ dir, onClick, label }: { dir: 'prev' | 'next'; onClick: () => void; label: string }) {
  return (
    <button type="button" className="cal-arrow" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d={dir === 'prev' ? 'M15.5 4.5 Q10.5 9 7.8 12.2 Q11 15.2 15.2 19.6' : 'M8.5 4.5 Q13.5 9 16.2 12.2 Q13 15.2 8.8 19.6'} />
      </svg>
    </button>
  )
}
