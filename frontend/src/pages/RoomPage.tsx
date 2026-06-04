import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RoomState, Track } from '../types'
import Sidebar from '../components/Sidebar'
import NowPlaying from '../components/NowPlaying'
import Library from '../components/Library'
import { io, Socket } from 'socket.io-client'

const MOCK_LIBRARY: Track[] = [
  { id: '1', title: 'lofi study beats vol.1', uploaderNick: '별이', durationSec: 214, s3Key:'' },
  { id: '2', title: 'rainy day jazz', uploaderNick: '민준', durationSec: 187 ,s3Key:''},
  { id: '3', title: 'chill hop afternoon', uploaderNick: '유진', durationSec: 243, s3Key:'' },
  { id: '4', title: 'pixel world bgm', uploaderNick: '별이', durationSec: 165 , s3Key:''},
  { id: '5', title: 'café window seat', uploaderNick: '민준', durationSec: 298, s3Key:'' },
]

const MOCK_PARTICIPANTS = [
  { id: 'p1', nick: '별이' },
  { id: 'p2', nick: '민준' },
  { id: 'p3', nick: '유진' },
]

export default function RoomPage() {
  const { roomCode = '' } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)
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

  useEffect(() => {
    if (!roomCode) return

    const BACKEND = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000`

    // 연결 시 query로 roomCode와 nick을 주입 → 서버가 join_room 없이 바로 방 배정
    const socket = io(BACKEND, {
      query: { roomCode, nick: myNick }
    })
    socketRef.current = socket

    // 입장 직후 방 전체 상태 수신 (중간 진입자 동기화 핵심)
    socket.on('room_state', (state) => {
      console.log('🏠 방 전체 상태 수신:', state)
      // startedAt(절대 시각)으로 현재 재생 위치 계산
      const progressSec = state.isPlaying
        ? Math.floor((Date.now() - state.startedAt) / 1000)
        : (state.progressAtPause ?? 0)
      setRoom((prev) => ({
        ...prev,
        participants: state.participants,
        library: state.library,
        nowPlaying: state.nowPlaying,
        isPlaying: state.isPlaying,
        progressSec,
      }))
    })

    // 유저 입장/퇴장 시 참여자 명단 업데이트
    socket.on('participant_update', ({ participants }) => {
      console.log('👥 참여자 명단 업데이트:', participants)
      setRoom((p) => ({ ...p, participants }))
    })

    // 재생/일시정지 동기화
    socket.on('playback_sync', (data) => {
      console.log('📨 playback_sync 수신:', data)
      const progressSec = data.isPlaying
        ? Math.floor((Date.now() - data.startedAt) / 1000)
        : (data.progressAtPause ?? 0)
      setRoom((p) => ({ ...p, isPlaying: data.isPlaying, progressSec }))
    })

    // 곡 전환 동기화 (skip / switch / 자동 전환)
    socket.on('track_changed', (data) => {
      console.log('🎵 track_changed 수신:', data)
      setRoom((prev) => {
        const next = prev.library.find((t) => t.id === data.nowPlayingId) ?? null
        return { ...prev, nowPlaying: next, progressSec: 0, isPlaying: data.isPlaying }
      })
    })

    socket.on('disconnect', () => {
      console.log('❌ 소켓 연결 끊김')
    })

    return () => { socket.disconnect() }
  }, [roomCode])

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

  // 서버한테 요청만 보내고, 상태 변경은 서버가 보내는 playback_sync/track_changed를 받아서 처리
  function handlePlay() {
    socketRef.current?.emit('play')
  }
  function handlePause() {
    socketRef.current?.emit('pause')
  }
  function handleSkip() {
    socketRef.current?.emit('skip')
  }
  function handleSwitch(track: Track) {
    socketRef.current?.emit('switch', { trackId: track.id })
  }
  async function handleUpload(file: File) {
    const apiUrl = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000`

    // 1. 백엔드에서 S3 presigned PUT URL 발급
    const res = await fetch(`${apiUrl}/api/upload-url?filename=${encodeURIComponent(file.name)}`)
    if (!res.ok) throw new Error('upload-url 발급 실패')
    const { uploadUrl } = await res.json() as { uploadUrl: string }

    // 2. S3에 직접 PUT 업로드
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
    if (!putRes.ok) throw new Error('S3 업로드 실패')

    // 3. presigned URL 경로에서 s3Key 추출 후 라이브러리에 추가
    const s3Key = new URL(uploadUrl).pathname.slice(1)
    const newTrack: Track = {
      id: Date.now().toString(),
      title: file.name.replace(/\.mp3$/i, ''),
      uploaderNick: myNick,
      durationSec: 0,
      s3Key,
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
          ♪ 함께 듣는 음악
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
