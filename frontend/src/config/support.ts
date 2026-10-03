// 개발자 응원하기에 보여줄 방법. 비워 두면 그 버튼은 나타나지 않는다(전부 비우면 "준비 중" 문구).
// 링크와 계좌는 화면에 공개되는 정보라 비밀이 아니다. 비밀번호/키는 여기에 넣지 말 것.
export const SUPPORT = {
  /** 토스 송금 링크. 예: 'https://toss.me/아이디' */
  toss: '',
  /** 카카오페이 송금 링크(또는 QR 링크). 예: 'https://qr.kakaopay.com/...' */
  kakaopay: '',
  /** 계좌로 응원하기. 번호는 화면에 크게 보이지 않고 "복사" 버튼으로만 쓴다. */
  account: { bank: '', number: '', holder: '' },
}

export const hasAccount = SUPPORT.account.bank !== '' && SUPPORT.account.number !== ''
export const hasAnySupport = SUPPORT.toss !== '' || SUPPORT.kakaopay !== '' || hasAccount
