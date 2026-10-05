import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Legal from '../components/Legal'
import { deleteAccountSections, privacySections, termsSections } from './legalText'

export type LegalKind = 'terms' | 'privacy' | 'delete-account'

const DOCS = {
  terms: { title: '이용약관', sections: termsSections },
  privacy: { title: '개인정보처리방침', sections: privacySections },
  'delete-account': { title: '계정 삭제 안내', sections: deleteAccountSections },
} as const

/**
 * 로그인 없이 열리는 공개 문서 페이지(/terms, /privacy, /delete-account).
 * 스토어 등록·계정 삭제 안내 주소로 쓰므로 로그인 여부와 상관없이 같은 내용을 보여준다.
 */
export default function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = DOCS[kind]
  useEffect(() => {
    const prev = document.title
    document.title = `${doc.title} · 뭐입을옷?`
    return () => {
      document.title = prev
    }
  }, [doc.title])
  return (
    <main className="legal-page">
      <div className="page-head">
        <h1>{doc.title}</h1>
        <Link to="/" className="dbtn small">
          처음으로
        </Link>
      </div>
      <Legal sections={doc.sections} showEffective={kind !== 'delete-account'} />
      <nav className="legal-links tiny" aria-label="다른 문서">
        {(Object.keys(DOCS) as LegalKind[])
          .filter((k) => k !== kind)
          .map((k) => (
            <Link key={k} to={`/${k}`}>
              {DOCS[k].title}
            </Link>
          ))}
      </nav>
    </main>
  )
}
