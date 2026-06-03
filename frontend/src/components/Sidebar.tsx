import { useRef, useState } from 'react'
import type { Participant } from '../types'

interface Props {
  roomCode: string
  participants: Participant[]
  myNick: string
  onUpload: (file: File) => Promise<void>
}

export default function Sidebar({ roomCode, participants, myNick, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [popup, setPopup] = useState<string | null>(null)
  const [zoneHovered, setZoneHovered] = useState(false)
  const [uploading, setUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return
    const name = selectedFile.name.replace(/\.mp3$/i, '')
    setUploading(true)
    try {
      await onUpload(selectedFile)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setPopup(`♪ "${name}" 추가됐어요!`)
    } catch {
      setPopup('업로드 실패. 다시 시도해 주세요.')
    } finally {
      setUploading(false)
      setTimeout(() => setPopup(null), 2500)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode).catch(() => {})
  }

  return (
    <>
      {/* 팝업 알림 */}
      {popup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'var(--bg-box)',
          border: '1px solid var(--accent-blue)',
          boxShadow: '2px 2px 0 var(--shadow-dot)',
          padding: '10px 20px',
          fontSize: '12px',
          color: 'var(--text-main)',
          whiteSpace: 'nowrap',
        }}>
          {popup}
        </div>
      )}

      <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 방 정보 */}
        <div className="box">
          <div className="box__title">[ 방 정보 ]</div>
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>
            방 코드:{' '}
            <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold', letterSpacing: '1px' }}>
              {roomCode}
            </span>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={copyCode}>
            코드 복사
          </button>
        </div>

        {/* 참여자 */}
        <div className="box">
          <div className="box__title">[ 참여자 ({participants.length}) ]</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {participants.map((p) => (
              <li key={p.id} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--accent-warm)', fontSize: '10px' }}>♡</span>
                <span style={{ fontWeight: p.nick === myNick ? 'bold' : 'normal' }}>{p.nick}</span>
                {p.isOwner && (
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--accent-warm)',
                    border: '1px solid var(--accent-warm)',
                    padding: '0 3px',
                    lineHeight: '14px',
                  }}>방장</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 업로드 */}
        <div className="box">
          <div className="box__title">[ MP3 업로드 ]</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,.mp3"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* 업로드 존 */}
            {!selectedFile ? (
              /* 빈 상태 — 클릭 유도 */
              <div
                style={{
                  border: `1px dashed ${zoneHovered ? 'var(--accent-blue)' : 'var(--border)'}`,
                  background: zoneHovered ? 'var(--bg-soft)' : 'var(--bg-box)',
                  padding: '16px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setZoneHovered(true)}
                onMouseLeave={() => setZoneHovered(false)}
              >
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: zoneHovered ? 'var(--text-main)' : 'var(--text-sub)',
                  marginBottom: '3px',
                }}>
                  클릭하여 파일 선택
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                  .mp3 파일만 가능
                </div>
              </div>
            ) : (
              /* 파일 선택됨 — 파일명 + 업로드/취소 */
              <div style={{
                border: '1px solid var(--accent-blue)',
                background: '#EEF9FD',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>♪</span>
                  <span style={{
                    flex: 1,
                    fontSize: '11px',
                    color: 'var(--text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-faint)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={uploading}
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '11px',
                      padding: '3px 10px',
                      background: uploading ? 'var(--bg-soft)' : 'var(--accent-blue)',
                      border: '1px solid #6EC9D8',
                      color: 'var(--text-main)',
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={handleUpload}
                  >
                    {uploading ? '업로드 중…' : '업로드 ▲'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
              ※ 누구나 곡을 추가할 수 있어요
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
