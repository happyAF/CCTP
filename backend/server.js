require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// S3 클라이언트 세팅
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 클라이언트가 S3 티켓(URL)을 요청하는 API
app.get('/api/upload-url', async (req, res) => {
  try {
    // 프론트에서 보낼 파일 이름
    const { filename } = req.query; 

    // S3에 이 이름으로 파일을 올리겠다는 명령서 작성
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `uploads/${Date.now()}_${filename}`, // 파일 덮어쓰기 방지용 시간 추가
    });

    // 명령서를 바탕으로 60초 동안만 유효한  URL 생성
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    res.json({ uploadUrl });
  } catch (error) {
    console.error('S3 Presigned URL 생성 실패:', error);
    res.status(500).json({ error: 'URL 생성에 실패했습니다.' });
  }
});

// ── 방 상태 저장소 (메모리 인메모리, 추후 Redis로 교체 가능) ──
// roomCode → roomState 매핑
const rooms = new Map()

// 새 방 상태 초기화 헬퍼
function createRoom(roomCode) {
  return {
    roomCode,
    participants: [],   
    // 태스트용
    library: [{ id: '1', title: 'lofi study beats vol.1', durationSec: 214 }], 
    nowPlaying: { id: '1', title: 'lofi study beats vol.1', durationSec: 214 },
    isPlaying: true, 
    startedAt: Date.now(), 
    progressAtPause: null, 
    autoAdvanceTimer: null, 
  }
}

io.on('connection', (socket) => {
  // 연결 시 쿼리파라미터에서 roomCode, nick 추출
  const { roomCode, nick } = socket.handshake.query

  // ── 방 입장 처리 ──
  if (!rooms.has(roomCode)) rooms.set(roomCode, createRoom(roomCode))
  const room = rooms.get(roomCode)
  const isOwner = room.participants.length === 0
  room.participants.push({ id: socket.id, nick, isOwner })
  socket.join(roomCode)
  console.log(`🟢 [${nick}] 입장 → 방 [${roomCode}] (현재 ${room.participants.length}명)`)

  // 입장 직후 본인에게만 현재 방 전체 상태 전송 (중간 진입자 동기화 핵심)
  socket.emit('room_state', {
    selfId: socket.id,
    roomCode,
    participants: room.participants,
    library: room.library,
    nowPlaying: room.nowPlaying,
    isPlaying: room.isPlaying,
    startedAt: room.startedAt,
    progressAtPause: room.progressAtPause,
  })

  // 방 전체에 참여자 목록 업데이트 브로드캐스트
  io.to(roomCode).emit('participant_update', { participants: room.participants })

  // ── play 이벤트 ──
  socket.on('play', () => {
    console.log(`▶️  [${nick}] play → 방 [${roomCode}]`)
    if (!room.nowPlaying) return
    // 일시정지 상태에서 재개: 멈췄던 위치부터 시작하도록 startedAt 역산
    room.startedAt = Date.now() - (room.progressAtPause ?? 0) * 1000
    room.isPlaying = true
    room.progressAtPause = null
    scheduleAutoAdvance(room) // 곡 자동 전환 타이머 재설정
    io.to(roomCode).emit('playback_sync', {
      isPlaying: true,
      startedAt: room.startedAt,
      progressAtPause: null,
      nowPlayingId: room.nowPlaying.id,
    })
  })

  // ── pause 이벤트 ──
  socket.on('pause', () => {
    console.log(`⏸️  [${nick}] pause → 방 [${roomCode}]`)
    if (!room.nowPlaying || !room.isPlaying) return
    room.progressAtPause = (Date.now() - room.startedAt) / 1000
    room.startedAt = null
    room.isPlaying = false
    clearAutoAdvance(room)
    io.to(roomCode).emit('playback_sync', {
      isPlaying: false,
      startedAt: null,
      progressAtPause: room.progressAtPause,
      nowPlayingId: room.nowPlaying.id,
    })
  })

  // ── skip 이벤트 ──
  socket.on('skip', () => {
    console.log(`⏭️  [${nick}] skip → 방 [${roomCode}]`)
    advanceTrack(room, roomCode)
  })

  // ── switch 이벤트 ──
  socket.on('switch', ({ trackId }) => {
    const track = room.library.find((t) => t.id === trackId)
    if (!track) return socket.emit('error', { code: 'INVALID_TRACK' })
    room.nowPlaying = track
    room.startedAt = Date.now()
    room.isPlaying = true
    room.progressAtPause = null
    scheduleAutoAdvance(room)
    io.to(roomCode).emit('track_changed', {
      nowPlayingId: track.id,
      isPlaying: true,
      startedAt: room.startedAt,
      progressAtPause: null,
    })
  })

  // ── upload_done 이벤트 ──
  socket.on('upload_done', ({ title, uploaderNick, durationSec, s3Key }) => {
    const newTrack = { id: Date.now().toString(), title, uploaderNick, durationSec, s3Key }
    room.library.push(newTrack)
    // 첫 곡이면 자동으로 재생 시작
    if (!room.nowPlaying) {
      room.nowPlaying = newTrack
      room.startedAt = Date.now()
      room.isPlaying = true
      scheduleAutoAdvance(room)
    }
    io.to(roomCode).emit('library_update', { library: room.library })
  })

  // ── 연결 종료 ──
  socket.on('disconnect', () => {
    console.log(`🔴 [${nick}] 퇴장 → 방 [${roomCode}]`)
    room.participants = room.participants.filter((p) => p.id !== socket.id)
    if (room.participants.length === 0) {
      clearAutoAdvance(room)
      rooms.delete(roomCode)
    } else {
      io.to(roomCode).emit('participant_update', { participants: room.participants })
    }
  })
})

// ── 헬퍼: 곡 자동 전환 타이머 ──
function scheduleAutoAdvance(room) {
  clearAutoAdvance(room)
  if (!room.nowPlaying || !room.isPlaying) return
  const remaining = room.nowPlaying.durationSec * 1000 - (Date.now() - room.startedAt)
  room.autoAdvanceTimer = setTimeout(() => advanceTrack(room, room.roomCode), remaining)
}

function clearAutoAdvance(room) {
  if (room.autoAdvanceTimer) {
    clearTimeout(room.autoAdvanceTimer)
    room.autoAdvanceTimer = null
  }
}

function advanceTrack(room, roomCode) {
  const idx = room.library.findIndex((t) => t.id === room.nowPlaying?.id)
  const next = room.library[idx + 1] ?? null
  room.nowPlaying = next
  room.startedAt = next ? Date.now() : null
  room.isPlaying = !!next
  room.progressAtPause = null
  clearAutoAdvance(room)
  if (next) scheduleAutoAdvance(room)
  io.to(roomCode).emit('track_changed', {
    nowPlayingId: next?.id ?? null,
    isPlaying: room.isPlaying,
    startedAt: room.startedAt,
    progressAtPause: null,
  })
}

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버 ${PORT} 포트에서 작동 (웹소켓 포함)`);
});