// 버튼 안에 들어가는 손그림 아이콘(이모지 대신 앱의 낙서 그림체로). 선은 .doodle 필터로 살짝 흔들린다.
const common = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: '#222',
  strokeWidth: 2.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'doodle btn-icon',
  'aria-hidden': true,
}

/** 카메라: 사진으로 옷을 찾을 때 */
export function CameraIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M4 11.5 Q4 9.5 6.2 9.5 H10 L12.2 6 H19.8 L22 9.5 H25.8 Q28 9.5 28 11.5 V23.5 Q28 26 25.6 26 H6.4 Q4 26 4 23.5 Z" fill="#fcfcfa" />
      <circle cx="16" cy="17.2" r="5.2" fill="#cfe6e2" />
      <path d="M13.8 16.2 Q15 14.8 16.8 15" strokeWidth="1.6" />
      <path d="M24 13.2 h.1" strokeWidth="3.2" />
    </svg>
  )
}

/** 손: 직접 고를 때 */
export function HandIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path
        d="M11 27 Q6.5 24.5 6.5 19.5 V13 Q6.5 11.2 8.2 11.2 Q9.8 11.2 9.8 13 V17 V7.2 Q9.8 5.4 11.5 5.4 Q13.2 5.4 13.2 7.2 V15.5 V5.4 Q13.2 3.6 14.9 3.6 Q16.6 3.6 16.6 5.4 V15.5 V7 Q16.6 5.2 18.3 5.2 Q20 5.2 20 7 V17 V12.8 Q20 11 21.7 11 Q23.4 11 23.4 12.8 V20 Q23.4 25 19 27 Z"
        fill="#f6e3c4"
      />
      <path d="M9.8 17 V19 M13.2 15.5 V19 M16.6 15.5 V19 M20 17 V19" strokeWidth="1.5" />
    </svg>
  )
}

/** 자물쇠: 아직 잠겨 있는 것(옷을 더 등록하면 열리는 캐릭터)을 알릴 때 */
export function LockIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common} aria-hidden="true">
      <path d="M10 14 V10.5 Q10 5 16 5 Q22 5 22 10.5 V14" />
      <path d="M7 14 H25 V26 Q25 27.5 23.5 27.5 H8.5 Q7 27.5 7 26 Z" fill="#f2cf4a" />
      <path d="M16 19 v3.5" strokeWidth="2.6" />
      <circle cx="16" cy="18.6" r="1.4" fill="#222" stroke="none" />
    </svg>
  )
}
