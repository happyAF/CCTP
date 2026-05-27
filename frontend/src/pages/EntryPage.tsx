import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function EntryPage() {
  const navigate = useNavigate()
  const [nick, setNick] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')

  function handleEnter() {
    setError('')
    if (!nick.trim()) { setError('닉네임을 입력해 주세요.'); return }
    if (mode === 'join' && !joinCode.trim()) { setError('방 코드를 입력해 주세요.'); return }

    localStorage.setItem('nick', nick.trim())
    const code = mode === 'create' ? generateRoomCode() : joinCode.trim().toUpperCase()
    if (mode === 'create') localStorage.setItem('ownerRoom', code)
    navigate(`/room/${code}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleEnter()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '20px',
    }}>
      <div
        className="box"
        style={{
          width: '400px',
          maxWidth: '100%',
          boxShadow: '2px 2px 0 var(--shadow-dot)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* 제목 */}
        <div style={{
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--text-main)',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-soft)',
          letterSpacing: '1px',
        }}>
          ♪ 함께 듣는 작은 방
        </div>

        {/* 닉네임 */}
        <div>
          <label className="label" htmlFor="nick-input">닉네임</label>
          <input
            id="nick-input"
            className="input"
            type="text"
            placeholder="사용할 닉네임을 입력하세요"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={16}
          />
        </div>

        {/* 라디오 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <RadioOption
            id="opt-create"
            checked={mode === 'create'}
            label="새 방 만들기"
            onChange={() => setMode('create')}
          />
          <RadioOption
            id="opt-join"
            checked={mode === 'join'}
            label="방 코드로 입장"
            onChange={() => setMode('join')}
          />
        </div>

        {/* 방 코드 입력 */}
        {mode === 'join' && (
          <div>
            <label className="label" htmlFor="code-input">방 코드</label>
            <input
              id="code-input"
              className="input"
              type="text"
              placeholder="6자리 방 코드"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '3px' }}
            />
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ fontSize: '11px', color: '#c0392b', borderLeft: '2px solid #c0392b', paddingLeft: '6px' }}>
            {error}
          </div>
        )}

        {/* 입장 버튼 */}
        <button
          className="btn"
          style={{ width: '100%', padding: '7px 10px', fontSize: '13px' }}
          onClick={handleEnter}
        >
          입장하기
        </button>
      </div>

      {/* 푸터 */}
      <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-faint)' }}>
        © 2026 cloudcomputing termproject
      </div>
    </div>
  )
}

function RadioOption({
  id, checked, label, onChange,
}: { id: string; checked: boolean; label: string; onChange: () => void }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        color: checked ? 'var(--text-main)' : 'var(--text-sub)',
      }}
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
      />
      {label}
    </label>
  )
}
