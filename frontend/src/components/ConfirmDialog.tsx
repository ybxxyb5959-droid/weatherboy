import DoodleButton from './DoodleButton'

interface Props {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 한 번 더 확인하는 작은 창 (우리 낙서 스타일). 바깥을 누르면 취소된다. */
export default function ConfirmDialog({ title, message, confirmLabel = '확인', cancelLabel = '취소', busy, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-back" role="presentation" onClick={onCancel}>
      <div className="modal box w2" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="row stretch" style={{ marginTop: 14 }}>
          <DoodleButton seed={0} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </DoodleButton>
          <DoodleButton seed={2} className="danger-btn" onClick={onConfirm} disabled={busy}>
            {busy ? '잠시만요…' : confirmLabel}
          </DoodleButton>
        </div>
      </div>
    </div>
  )
}
