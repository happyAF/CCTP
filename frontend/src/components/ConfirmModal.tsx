import type { Track } from '../types'

interface Props {
  track: Track
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ track, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">♪ 곡 전환</div>
        <hr className="modal-divider" />
        <div className="modal-body" style={{ textAlign: 'center' }}>
          &ldquo;{track.title}&rdquo; (으)로<br />
          바꾸시겠습니까?<br />
          모든 참여자에게 즉시<br />
          반영됩니다.
        </div>
        <div className="modal-actions">
          <button className="btn btn--blue" onClick={onConfirm}>확인</button>
          <button className="btn btn--ghost" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  )
}
