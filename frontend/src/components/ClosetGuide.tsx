import { useState } from 'react'
import ClothingDoodle from './ClothingDoodle'
import DoodleButton from './DoodleButton'
import HandText from './HandText'

// 옷장·행거 사진 등록 가이드: 처음 한 번 3장으로 "상하의 따로 → 이렇게 찍기 → 틀린 건 고치기"를 손그림으로 알려 준다.
// 막지 않고 건너뛸 수 있다. 본 뒤에는 기기에 기억해 다시 자동으로 열리지 않고, 사진 등록 화면의 "촬영 팁"으로 다시 볼 수 있다.

const KEY = 'wb-closet-guide-seen'

export const closetGuideSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* 저장이 막힌 환경: 다음에 또 보여줘도 괜찮다 */
  }
}

/** 점선 네모에 모서리 괄호: 카메라가 보는 범위 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="cg-frame">
      <svg className="doodle cg-corners" viewBox="0 0 200 110" fill="none" stroke="#222" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 24 V10 Q8 6 12 6 H26 M174 6 H188 Q192 6 192 10 V24 M192 86 V100 Q192 104 188 104 H174 M26 104 H12 Q8 104 8 100 V86" />
      </svg>
      {children}
    </div>
  )
}

/** 걸린 옷을 한 줄로 늘어놓은 그림 */
function Hung({ items }: { items: { type: string; color: string; pattern?: string }[] }) {
  return (
    <div className="cg-hung">
      <svg className="doodle cg-rod" viewBox="0 0 200 8" fill="none" stroke="#222" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4 Q50 1 100 4 T196 4" />
      </svg>
      <div className="cg-row">
        {items.map((it, i) => (
          <ClothingDoodle key={i} type={it.type} color={it.color} pattern={it.pattern} size={54} />
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: '상의와 하의는 따로 찍어요',
    text: '사진을 올리기 전에 "상의·겉옷만" 또는 "하의만"을 골라 주세요. 상의와 하의를 헷갈리는 실수가 크게 줄어요.',
    art: (
      <div className="cg-two">
        <div className="cg-pick">
          <ClothingDoodle type="셔츠" color="하늘색" size={64} />
          <span className="cg-chip on">상의·겉옷만</span>
        </div>
        <span className="cg-or" aria-hidden="true">/</span>
        <div className="cg-pick">
          <ClothingDoodle type="바지" color="파랑" size={64} />
          <span className="cg-chip">하의만</span>
        </div>
      </div>
    ),
  },
  {
    title: '밝은 곳에서, 겹치지 않게',
    text: '한 장에 3~4벌씩, 앞면이 보이게 걸어서 찍어요. 가로로 긴 사진은 알아서 3구간으로 나눠 살펴봐요.',
    art: (
      <Frame>
        <Hung
          items={[
            { type: '반팔', color: '흰색' },
            { type: '셔츠', color: '하늘색', pattern: '줄무늬' },
            { type: '맨투맨', color: '회색' },
            { type: '자켓', color: '네이비' },
          ]}
        />
      </Frame>
    ),
  },
  {
    title: '틀린 옷은 바로 고쳐요',
    text: '결과에서 종류나 색이 틀리면 [수정]을 누르고, 필요 없는 옷은 체크를 풀어 주세요. 이미 가진 옷은 알아서 빼 줘요.',
    art: (
      <div className="cg-item">
        <span className="cg-box on" aria-hidden="true">✓</span>
        <ClothingDoodle type="셔츠" color="하늘색" pattern="줄무늬" size={46} />
        <div className="cg-info">
          <b>줄무늬 셔츠</b>
          <span className="tiny">셔츠 · 하늘색</span>
        </div>
        <span className="cg-mini">수정</span>
      </div>
    ),
  },
]

export default function ClosetGuide({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]!
  const last = i === STEPS.length - 1
  const close = () => {
    markSeen()
    onClose()
  }
  return (
    <section className="box w2 cg" aria-label="옷장 사진 등록 가이드">
      <div className="cg-top">
        <span className="tiny">사진 등록 가이드 {i + 1}/{STEPS.length}</span>
        <button type="button" className="cg-skip" onClick={close}>
          건너뛰기
        </button>
      </div>
      <div key={i} className="cg-step">
        <div className="cg-art">{step.art}</div>
        <h2>
          <HandText>{step.title}</HandText>
        </h2>
        <p className="tiny">{step.text}</p>
      </div>
      <div className="cg-nav">
        <span className="cg-dots" aria-hidden="true">
          {STEPS.map((_, k) => (
            <i key={k} className={k === i ? 'on' : ''} />
          ))}
        </span>
        <span className="cg-btns">
          {i > 0 && (
            <DoodleButton seed={2} className="small" onClick={() => setI(i - 1)}>
              이전
            </DoodleButton>
          )}
          <DoodleButton seed={1} className="small" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? '알겠어요' : '다음'}
          </DoodleButton>
        </span>
      </div>
    </section>
  )
}
