import { LEGAL_EFFECTIVE, OPERATOR, type LegalSection } from '../pages/legalText'

/** 약관·방침 본문: 설정 안과 로그인 없이 열리는 공개 페이지가 함께 쓴다 */
export default function Legal({ sections, showEffective = true }: { sections: LegalSection[]; showEffective?: boolean }) {
  return (
    <div className="legal">
      <p className="tiny">
        운영자: {OPERATOR.name} · 문의: {OPERATOR.contact}
        {showEffective ? ` · 시행일 ${LEGAL_EFFECTIVE}` : ''}
      </p>
      {sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  )
}
