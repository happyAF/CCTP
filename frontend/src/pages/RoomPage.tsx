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

interface PlaybackOpts {
  isPlaying: boolean
  startedAt: number | null
  playAt: number | null
  progressAtPause: number | null
}

export default function RoomPage() {
  const { roomCode = '' } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 3000)
  }

  const [room, setRoom] = useState<RoomState>({
    roomCode,
    participants: buildInitialParticipants(),
    library: MOCK_LIBRARY,
    nowPlaying: MOCK_LIBRARY[0],
    isPlaying: true,
    progressSec: 42,
  })

  // roomRef: socket 핸들러 내 stale closure 없이 최신 library 참조용
  const roomRef = useRef<RoomState>(room)
  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (!localStorage.getItem('nick')) navigate('/')
  }, [navigate])

  // ── 오디오 엘리먼트 초기화 ──
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    // 실제 재생 위치로 progressSec 업데이트 (가짜 setInterval 대체)
    const onTimeUpdate = () => {
      setRoom((prev) => ({ ...prev, progressSec: Math.floor(audio.currentTime) }))
    }
    audio.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      if (playTimerRef.current) clearTimeout(playTimerRef.current)
      audioRef.current = null
    }
  }, [])

  // ── 재생 상태를 오디오 엘리먼트에 반영 ──
  function applyPlayback({ isPlaying, startedAt, playAt, progressAtPause }: PlaybackOpts) {
    const audio = audioRef.current
    if (!audio) return

    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }

    if (!isPlaying) {
      audio.pause()
      audio.currentTime = progressAtPause ?? 0
      return
    }

    if (playAt !== null && Date.now() < playAt) {
      // playAt이 미래: 그 시점에 맞는 위치로 미리 seek 후 타이머로 재생
      audio.currentTime = startedAt !== null ? Math.max((playAt - startedAt) / 1000, 0) : 0
      playTimerRef.current = setTimeout(() => {
        audio.play().catch(() => {})
      }, playAt - Date.now())
    } else if (startedAt !== null) {
      // 이미 재생 중이거나 지각 입장: 현재 위치로 즉시 seek 후 재생
      audio.currentTime = Math.max((Date.now() - startedAt) / 1000, 0)
      audio.play().catch(() => {})
    }
  }

  // ── presigned GET URL 발급 ──
  async function fetchPlayUrl(s3Key: string): Promise<string> {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/play-url?s3Key=${encodeURIComponent(s3Key)}`)
    if (!res.ok) throw new Error('play-url 발급 실패')
    const { playUrl } = await res.json() as { playUrl: string }
    return playUrl
  }

  // ── 곡 로드 후 재생 상태 적용 ──
  async function loadAndApply(s3Key: string, opts: PlaybackOpts) {
    try {
      const playUrl = await fetchPlayUrl(s3Key)
      const audio = audioRef.current
      if (!audio) return
      audio.src = playUrl
      audio.load()
      applyPlayback(opts)
    } catch (e) {
      console.error('🎵 play-url 발급 실패:', e)
    }
  }

  useEffect(() => {
    if (!roomCode) return

    const BACKEND = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3000`

    // 연결 시 query로 roomCode와 nick을 주입 → 서버가 join_room 없이 바로 방 배정
    const socket = io(BACKEND, {
      query: { roomCode, nick: myNick }
    })
    socketRef.current = socket

    // 입장 직후 방 전체 상태 수신 → 오디오 src 설정 + 재생 위치 동기화
    socket.on('room_state', async (state: {
      participants: import('../types').Participant[]
      library: Track[]
      nowPlaying: Track | null
      isPlaying: boolean
      startedAt: number | null
      playAt: number | null
      progressAtPause: number | null
    }) => {
      console.log('🏠 방 전체 상태 수신:', state)
      const progressSec = state.isPlaying && state.startedAt !== null
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
      if (state.nowPlaying?.s3Key) {
        await loadAndApply(state.nowPlaying.s3Key, {
          isPlaying: state.isPlaying,
          startedAt: state.startedAt,
          playAt: state.playAt,
          progressAtPause: state.progressAtPause,
        })
      }
    })

    // 유저 입장/퇴장 시 참여자 명단 업데이트
    socket.on('participant_update', ({ participants }) => {
      console.log('👥 참여자 명단 업데이트:', participants)
      setRoom((p) => ({ ...p, participants }))
    })

    // 재생/일시정지 동기화 → 오디오 재생 상태 반영
    socket.on('playback_sync', (data: PlaybackOpts & { nowPlayingId: string }) => {
      console.log('📨 playback_sync 수신:', data)
      const progressSec = data.isPlaying && data.startedAt
        ? Math.floor((Date.now() - data.startedAt) / 1000)
        : (data.progressAtPause ?? 0)
      setRoom((p) => ({ ...p, isPlaying: data.isPlaying, progressSec }))
      applyPlayback({
        isPlaying: data.isPlaying,
        startedAt: data.startedAt,
        playAt: data.playAt,
        progressAtPause: data.progressAtPause,
      })
    })

    // 곡 전환 동기화 → 새 곡 src 설정 후 재생
    socket.on('track_changed', async (data) => {
      console.log('🎵 track_changed 수신:', data)
      setRoom((prev) => {
        const next = prev.library.find((t) => t.id === data.nowPlayingId) ?? null
        return { ...prev, nowPlaying: next, progressSec: 0, isPlaying: data.isPlaying }
      })
      const nextTrack = roomRef.current.library.find((t) => t.id === data.nowPlayingId)
      if (nextTrack?.s3Key) {
        await loadAndApply(nextTrack.s3Key, {
          isPlaying: data.isPlaying,
          startedAt: data.startedAt,
          playAt: null,
          progressAtPause: data.progressAtPause ?? null,
        })
      }
    })

    // 다른 사람이 곡 업로드했을 때 라이브러리 업데이트
    socket.on('library_update', ({ library }: { library: Track[] }) => {
      console.log('📚 library_update 수신:', library)
      setRoom((p) => ({ ...p, library }))
    })

    socket.on('error', ({ code, message }: { code: string; message?: string }) => {
      const msg: Record<string, string> = {
        ROOM_NOT_FOUND: '존재하지 않는 방입니다.',
        INVALID_TRACK: '라이브러리에 없는 곡입니다.',
        UPLOAD_FAILED: '업로드 검증에 실패했습니다.',
        INTERNAL_ERROR: '서버 오류가 발생했습니다.',
      }
      showError(msg[code] ?? message ?? '알 수 없는 오류가 발생했습니다.')
    })

    socket.on('disconnect', () => {
      console.log('❌ 소켓 연결 끊김')
    })

    return () => { socket.disconnect() }
  }, [roomCode])

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

    // 2. 파일에서 실제 재생 시간 추출 (서버 자동 전환에 필요)
    const durationSec = await new Promise<number>((resolve) => {
      const tempAudio = new Audio()
      const blobUrl = URL.createObjectURL(file)
      tempAudio.src = blobUrl
      tempAudio.onloadedmetadata = () => {
        resolve(Math.round(tempAudio.duration))
        URL.revokeObjectURL(blobUrl)
      }
      tempAudio.onerror = () => { resolve(0); URL.revokeObjectURL(blobUrl) }
    })

    // 3. S3에 직접 PUT 업로드
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
    if (!putRes.ok) throw new Error('S3 업로드 실패')

    // 4. 서버에 트랙 정보 등록 → 서버가 library_update 브로드캐스트
    const s3Key = new URL(uploadUrl).pathname.slice(1)
    socketRef.current?.emit('upload_done', {
      title: file.name.replace(/\.mp3$/i, ''),
      uploaderNick: myNick,
      durationSec,
      s3Key,
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 에러 토스트 */}
      {errorMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'var(--bg-box)',
          border: '1px solid #c0392b',
          boxShadow: '2px 2px 0 var(--shadow-dot)',
          padding: '10px 20px',
          fontSize: '12px',
          color: '#c0392b',
          whiteSpace: 'nowrap',
        }}>
          ✕ {errorMsg}
        </div>
      )}

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
