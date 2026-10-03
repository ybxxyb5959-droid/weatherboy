import { useState } from 'react'
import BackButton from '../components/BackButton'
import CheerScene from '../components/CheerScene'
import HandText from '../components/HandText'
import { hasAccount, hasAnySupport, SUPPORT } from '../config/support'

/** 설정 > 개발자 응원하기. 밤샘 코딩 중인 졸라맨 그림과 응원 방법(링크가 채워진 것만). */
export default function CheerPage() {
  const [note, setNote] = useState('')

  const copyAccount = async () => {
    const { bank, number } = SUPPORT.account
    try {
      await navigator.clipboard.writeText(number)
      setNote(`${bank} 계좌번호를 복사했어요! 송금 앱에 붙여넣어 주세요 ^_^`)
    } catch {
      // 복사를 못 하는 브라우저: 직접 보고 적을 수 있게 보여준다
      setNote(`${bank} ${number}`)
    }
  }

  return (
    <main className="cheer">
      <div className="page-head">
        <div className="row">
          <BackButton to="/settings" label="설정으로 돌아가기" />
          <h1>개발자 응원하기</h1>
        </div>
      </div>

      <CheerScene />

      <p className="lead cheer-text">
        <span className="lead-line">
          <HandText>안녕하세요, 개발자예요.</HandText>
        </span>
        <span className="lead-line">
          <HandText>졸린 눈으로 밤새 만들고 있어요.</HandText>
        </span>
        <span className="lead-line">
          <HandText>마음에 드셨다면</HandText>
        </span>
        <span className="lead-line">
          <HandText>커피 한 잔 응원해주실래요? ^_^</HandText>
        </span>
      </p>

      {hasAnySupport ? (
        <div className="cheer-actions">
          {SUPPORT.toss && (
            <a className="dbtn block w1" href={SUPPORT.toss} target="_blank" rel="noopener noreferrer">
              토스로 응원하기
            </a>
          )}
          {SUPPORT.kakaopay && (
            <a className="dbtn block w2" href={SUPPORT.kakaopay} target="_blank" rel="noopener noreferrer">
              카카오페이로 응원하기
            </a>
          )}
          {hasAccount && (
            <button type="button" className="dbtn block w3" onClick={() => void copyAccount()}>
              계좌번호 복사하기
            </button>
          )}
          {note && (
            <p role="status" className="tiny cheer-note">
              {note}
            </p>
          )}
        </div>
      ) : (
        <p className="tiny cheer-soon">응원 방법을 준비하고 있어요. 조금만 기다려 주세요 ^_^</p>
      )}

      <p className="tiny cheer-foot">응원은 선택이에요. 안 하셔도 앱은 똑같이 써요 ^_^</p>
    </main>
  )
}
