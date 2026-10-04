import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import DoodleButton from './DoodleButton'
import { CloseIcon } from './ToolIcons'

interface Props {
  label?: string
  className?: string
}

/** "옷 등록하러 가기" 버튼. 누르면 아래에서 낙서 시트가 올라와 옷장 사진 / 한 벌씩 중에 고른다. */
export default function AddClothesSheet({ label = '+ 옷 등록하러 가기', className = 'dbtn w1 small' }: Props) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    nav(to)
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open &&
        createPortal(
          <div className="sheet-back" role="presentation" onClick={() => setOpen(false)}>
            <div className="sheet box w2" role="dialog" aria-modal="true" aria-label="옷 등록 방법" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head">
                <h2>어떻게 등록할까요?</h2>
                <button type="button" className="sheet-x" aria-label="닫기" onClick={() => setOpen(false)}>
                  <CloseIcon />
                </button>
              </div>
              <div className="col" style={{ gap: 10 }}>
                <DoodleButton seed={1} className="block" onClick={() => go('/wardrobe/scan')}>
                  옷장 사진으로 한꺼번에
                </DoodleButton>
                <p className="tiny sheet-hint">행거·옷장을 찍으면 여러 벌을 한 번에 찾아요</p>
                <DoodleButton seed={2} className="block" onClick={() => go('/wardrobe/add')}>
                  한 벌씩 추가
                </DoodleButton>
                <p className="tiny sheet-hint">말로 적거나 사진 한 장, 직접 고르기</p>
              </div>
              </div>
          </div>,
          document.body,
        )}
    </>
  )
}
