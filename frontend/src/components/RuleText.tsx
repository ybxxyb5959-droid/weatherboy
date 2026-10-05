import { Fragment } from 'react'

// 칭호 조건 문구: 조건마다 한 줄, "80% 이상"·"4벌 이상"은 중간에서 끊기지 않게, "·" 뒤에서는 줄을 바꿀 수 있게.
const UNIT = /(\d+(?:\.\d+)?(?:%|벌|색)\s?(?:이상|이하)·?)/g

function Req({ text }: { text: string }) {
  return (
    <span className="rule-line">
      {text.split(UNIT).map((part, i) =>
        i % 2 === 1 ? (
          <Fragment key={i}>
            <span className="nb">{part}</span>
            {part.endsWith('·') && <wbr />}
          </Fragment>
        ) : (
          <Fragment key={i}>
            {part.split('·').map((seg, j, all) => (
              <Fragment key={j}>
                {seg}
                {j < all.length - 1 && (
                  <>
                    ·<wbr />
                  </>
                )}
              </Fragment>
            ))}
          </Fragment>
        ),
      )}
    </span>
  )
}

export default function RuleText({ rule }: { rule: string }) {
  return (
    <>
      {rule.split(' / ').map((r) => (
        <Req key={r} text={r} />
      ))}
    </>
  )
}
