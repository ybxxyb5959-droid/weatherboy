import DoodleButton, { ChoiceRow } from './DoodleButton'
import { clothingTypes, colorHex, colorNames, patternNames } from '../mocks/clothes'
import type { ParsedClothing } from '../lib/clothingParse'

type Draft = ParsedClothing

/** 종류·색상·무늬를 직접 고르는 칸 (말로 적은 결과를 고칠 때도, 처음부터 직접 고를 때도 쓴다) */
export default function ClothingFields({ value, onChange }: { value: Draft; onChange: (v: Draft) => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...value, ...patch, colorGuessed: patch.color ? false : value.colorGuessed })
  return (
    <>
      <div className="field">
        <div className="name">종류</div>
        <ChoiceRow options={clothingTypes} value={value.type} onChange={(type) => set({ type })} />
      </div>
      <div className="field">
        <div className="name">색상</div>
        <div className="row wrap">
          {colorNames.map((c, i) => (
            <DoodleButton key={c} seed={i} selected={value.color === c} className="colorbtn" onClick={() => set({ color: c })}>
              <span className="swatch" style={{ background: colorHex[c] }} />
              {c}
            </DoodleButton>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="name">무늬</div>
        <ChoiceRow options={patternNames} value={value.pattern} onChange={(pattern) => set({ pattern })} />
      </div>
    </>
  )
}
