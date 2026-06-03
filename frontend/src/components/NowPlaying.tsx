import type { Track } from '../types'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface Props {
  track: Track | null
  isPlaying: boolean
  progressSec: number
  onPlay: () => void
  onPause: () => void
  onSkip: () => void
}

export default function NowPlaying({ track, isPlaying, progressSec, onPlay, onPause, onSkip }: Props) {
  const pct = track ? Math.min((progressSec / track.durationSec) * 100, 100) : 0

  return (
    <div className="box" style={{ flex: '0 0 auto' }}>
      <div className="box__title">[ Now Playing ♪ ]</div>

      {track ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--accent-blue)' }}>♪</span>{' '}
            <strong>{track.title}</strong>
            <span style={{ color: 'var(--text-sub)', marginLeft: '4px' }}>- {track.uploaderNick}</span>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-sub)', fontSize: '11px' }}>
              {formatTime(progressSec)} / {formatTime(track.durationSec)}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {isPlaying ? (
                <button className="btn" onClick={onPause}>⏸ 정지</button>
              ) : (
                <button className="btn" onClick={onPlay}>▶ 재생</button>
              )}
              <button className="btn" onClick={onSkip}>⏭ 스킵</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '18px 0',
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: '12px',
          letterSpacing: '2px',
        }}>
          · · · 아직 재생 중인 곡이 없어요 · · ·
        </div>
      )}
    </div>
  )
}
