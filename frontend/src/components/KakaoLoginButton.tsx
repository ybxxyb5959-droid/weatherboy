// 카카오 로그인 버튼. 카카오 로그인 디자인 가이드를 따른다 (우리 손그림 스타일을 입히지 않는다).
//  - 컨테이너 #FEE500, 심볼 #000000, 레이블 #000000 85% 투명도, OS 기본 서체
//  - 심볼의 모양/비율/색, 컨테이너 색은 바꾸지 않는다. 가로로 늘리거나 비율을 유지한 크기 조절만 한다.
// 정확한 심볼은 카카오 개발자 콘솔 [도구 > 리소스 다운로드 > 카카오 로그인] 의 공식 파일을 쓰는 것이 가장 안전하다.
// 아래 SVG 는 같은 모양을 코드로 옮긴 것이므로, 공식 파일을 받으면 이 심볼만 교체한다.

function KakaoSymbol() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#000000"
        d="M9 0.9C4.03 0.9 0 4.01 0 7.84c0 2.38 1.56 4.48 3.93 5.73l-1 3.67c-.09.33.29.59.57.4l4.36-2.9c.37.04.75.06 1.14.06 4.97 0 9-3.11 9-6.96C18 4.01 13.97 0.9 9 0.9z"
      />
    </svg>
  )
}

export default function KakaoLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="kakao-btn" onClick={onClick}>
      <KakaoSymbol />
      <span className="kakao-label">카카오 로그인</span>
    </button>
  )
}
