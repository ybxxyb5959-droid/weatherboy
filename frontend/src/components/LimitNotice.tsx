import type { ReactNode } from 'react'

/** AI 사용 한도에 걸렸을 때의 안내: 무엇이 막혔는지, 언제 풀리는지(서버 문장)와 그동안 할 수 있는 일(버튼) */
export default function LimitNotice({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="box w2 limit-notice" role="alert">
      <p>{message}</p>
      {children && <div className="limit-actions">{children}</div>}
    </div>
  )
}
