import type { ButtonHTMLAttributes } from 'react'
import HandText from './HandText'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  seed?: number
}

export function doodleClass(seed = 0, selected = false, extra = '') {
  return `dbtn w${seed % 4} ${selected ? 'on' : ''} ${extra}`.trim()
}

export default function DoodleButton({ selected, seed = 0, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected === undefined ? undefined : selected}
      className={doodleClass(seed, !!selected, className)}
      {...rest}
    >
      <HandText>{children}</HandText>
    </button>
  )
}

interface ChoiceProps<T extends string> {
  options: readonly T[]
  value: T | undefined
  onChange: (v: T) => void
}

export function ChoiceRow<T extends string>({ options, value, onChange }: ChoiceProps<T>) {
  return (
    <div className="row wrap">
      {options.map((o, i) => (
        <DoodleButton key={o} seed={i} selected={value === o} onClick={() => onChange(o)}>
          {o}
        </DoodleButton>
      ))}
    </div>
  )
}
