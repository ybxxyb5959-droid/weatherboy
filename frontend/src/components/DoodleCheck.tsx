import type { ReactNode } from 'react'

/**
 * 볼펜 낙서 스타일 체크박스. 진짜 input(checkbox)은 화면에서만 숨기고 그대로 둬서
 * 키보드/스크린리더에서도 평범한 체크박스로 동작한다.
 */
export default function DoodleCheck({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="dcheck">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <svg className="doodle dcheck-box" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5 L20 4 L19.5 19.5 L4.5 20 Z" fill={checked ? '#f2e8c8' : '#fcfcfa'} />
        {checked && <path className="dcheck-mark" d="M7 12.5 L10.5 16.5 L18 6.5" strokeWidth="3" />}
      </svg>
      <span>{children}</span>
    </label>
  )
}
