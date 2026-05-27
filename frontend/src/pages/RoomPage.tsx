import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RoomState, Track } from '../types'
import Sidebar from '../components/Sidebar'
import NowPlaying from '../components/NowPlaying'
import Library from '../components/Library'

const MOCK_LIBRARY: Track[] = [
  { id: '1', title: 'lofi study beats vol.1', uploaderNick: '별이', durationSec: 214 },
  { id: '2', title: 'rainy day jazz', uploaderNick: '민준', durationSec: 187 },
  { id: '3', title: 'chill hop afternoon', uploaderNick: '유진', durationSec: 243 },
  { id: '4', title: 'pixel world bgm', uploaderNick: '별이', durationSec: 165 },
  { id: '5', title: 'café window seat', uploaderNick: '민준', durationSec: 298 },
]

const MOCK_PARTICIPANTS = [
  { id: 'p1', nick: '별이' },
  { id: 'p2', nick: '민준' },
  { id: 'p3', nick: '유진' },
]

export default function RoomPage() {
  const { roomCode = '' } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const myNick = localStorage.getItem('nick') || '익명'
  const amIOwner = localStorage.getItem('ownerRoom') === roomCode

  function buildInitialParticipants() {
    const list = MOCK_PARTICIPANTS.map((p) => ({
      ...p,
      isOwner: p.nick === myNick && amIOwner,
    }))
    if (!list.some((p) => p.nick === myNick)) {
      list.unshift({ id: 'me', nick: myNick, isOwner: amIOwner })
    }
    return list
  }

  const [room, setRoom] = useState<RoomState>({
    roomCode,
    participants: buildInitialParticipants(),
    library: MOCK_LIBRARY,
    nowPlaying: MOCK_LIBRARY[0],
    isPlaying: true,
    progressSec: 42,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('nick')) navigate('/')
  }, [navigate])

  // Progress ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (room.isPlaying && room.nowPlaying) {
      timerRef.current = setInterval(() => {
        setRoom((prev) => {
          if (!prev.nowPlaying || !prev.isPlaying) return prev
          const next = prev.progressSec + 1
          if (next >= prev.nowPlaying.durationSec) {
            // auto-advance to next track
            const idx = prev.library.findIndex((t) => t.id === prev.nowPlaying!.id)
            const nextTrack = prev.library[idx + 1] ?? null
            return { ...prev, nowPlaying: nextTrack, progressSec: 0, isPlaying: !!nextTrack }
          }
          return { ...prev, progressSec: next }
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [room.isPlaying, room.nowPlaying?.id])

  function handlePlay() { setRoom((p) => ({ ...p, isPlaying: true })) }
  function handlePause() { setRoom((p) => ({ ...p, isPlaying: false })) }
  function handleSkip() {
    setRoom((prev) => {
      const idx = prev.library.findIndex((t) => t.id === prev.nowPlaying?.id)
      const next = prev.library[idx + 1] ?? null
      return { ...prev, nowPlaying: next, progressSec: 0, isPlaying: !!next }
    })
  }
  function handleSwitch(track: Track) {
    setRoom((prev) => ({ ...prev, nowPlaying: track, progressSec: 0, isPlaying: true }))
  }
  function handleUpload(file: File) {
    const newTrack: Track = {
      id: Date.now().toString(),
      title: file.name.replace(/\.mp3$/i, ''),
      uploaderNick: myNick,
      durationSec: 200,
    }
    setRoom((prev) => ({ ...prev, library: [...prev.library, newTrack] }))
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 상단 타이틀 바 */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-box)',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
        color: 'var(--text-sub)',
      }}>
        <span style={{ color: 'var(--text-main)', fontWeight: 'bold', fontSize: '13px' }}>
          ♪ 함께 듣는 작은 방
        </span>
        <span>/</span>
        <span>
          방 코드: <strong style={{ color: 'var(--accent-blue)' }}>{roomCode}</strong>
        </span>
        <span style={{ marginLeft: 'auto' }}>
          ♡ <span style={{ color: 'var(--text-main)' }}>{myNick}</span>
        </span>
      </div>

      {/* 본문 */}
      <div style={{
        flex: '1 1 0',
        display: 'flex',
        gap: '10px',
        padding: '10px',
        overflow: 'hidden',
      }}>
        {/* 좌측 사이드 */}
        <Sidebar
          roomCode={roomCode}
          participants={room.participants}
          myNick={myNick}
          onUpload={handleUpload}
        />

        {/* 우측 메인 */}
        <div style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <NowPlaying
            track={room.nowPlaying}
            isPlaying={room.isPlaying}
            progressSec={room.progressSec}
            onPlay={handlePlay}
            onPause={handlePause}
            onSkip={handleSkip}
          />
          <Library
            tracks={room.library}
            nowPlayingId={room.nowPlaying?.id ?? null}
            onSwitch={handleSwitch}
          />
        </div>
      </div>
    </div>
  )
}
