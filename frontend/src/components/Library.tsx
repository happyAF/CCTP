import { useState } from 'react'
import type { Track } from '../types'
import ConfirmModal from './ConfirmModal'

interface Props {
  tracks: Track[]
  nowPlayingId: string | null
  onSwitch: (track: Track) => void
}

export default function Library({ tracks, nowPlayingId, onSwitch }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null)

  return (
    <>
      <div className="box" style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="box__title">[ 방 라이브러리 ]</div>
        <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginBottom: '6px' }}>
          ※ 곡을 클릭하면 즉시 전환됩니다
        </div>

        <div style={{ flex: '1 1 0', overflowY: 'auto' }}>
          {tracks.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11px' }}>
              · · · 아직 곡이 없어요 · · ·
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '48px' }} />
                <col />
                <col style={{ width: '72px' }} />
                <col style={{ width: '108px' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>번호</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>제목</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>업로더</th>
                  <th style={{ ...thStyle }} />
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, idx) => {
                  const isHovered = hoveredId === track.id
                  const isNowPlaying = track.id === nowPlayingId
                  return (
                    <tr
                      key={track.id}
                      style={{
                        background: isHovered ? 'var(--bg-soft)' : 'var(--bg-box)',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-soft)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setHoveredId(track.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setPendingTrack(track)}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-sub)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{
                          visibility: (isNowPlaying || isHovered) ? 'visible' : 'hidden',
                          color: 'var(--accent-blue)',
                          marginRight: '4px',
                        }}>♪</span>
                        <span style={{
                          color: isHovered ? 'var(--accent-blue)' : isNowPlaying ? 'var(--accent-blue)' : 'var(--text-main)',
                          textDecoration: isHovered ? 'underline' : 'none',
                        }}>
                          {track.title}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.uploaderNick}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-sub)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <span style={{ visibility: isHovered ? 'visible' : 'hidden' }}>▶ 클릭하여 전환</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pendingTrack && (
        <ConfirmModal
          track={pendingTrack}
          onConfirm={() => { onSwitch(pendingTrack); setPendingTrack(null) }}
          onCancel={() => setPendingTrack(null)}
        />
      )}
    </>
  )
}

const thStyle: React.CSSProperties = {
  padding: '4px 6px',
  color: 'var(--text-sub)',
  fontWeight: 'normal',
  fontSize: '11px',
}

const tdStyle: React.CSSProperties = {
  padding: '5px 6px',
}
