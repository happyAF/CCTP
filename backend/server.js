require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

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

// ── Redis 클라이언트 ──
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// pubClient: 발행(publish) + 일반 명령(HSET/HGET 등)에 사용
// subClient: 구독(subscribe) 전용 (어댑터가 다른 서버의 emit을 수신)
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

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

// ── Redis 방 상태 헬퍼 (HSET/HGET) ──
// room:{roomCode}              (HASH) 재생 상태: library, nowPlayingId, isPlaying, startedAt, progressAtPause
// room:{roomCode}:participants (HASH) socketId → JSON({ nick, isOwner })
const ROOM_TTL = 60 * 60 * 24; // 24시간: 미사용 방 자동 만료 (좀비 키 방지)

const roomKey = (roomCode) => `room:${roomCode}`;
const participantsKey = (roomCode) => `room:${roomCode}:participants`;

// 방 재생 상태 읽기 (HGETALL) — 방이 없으면 null
async function getRoomState(roomCode) {
  const data = await pubClient.hGetAll(roomKey(roomCode));
  if (!data || Object.keys(data).length === 0) return null;
  return {
    roomCode,
    library: JSON.parse(data.library || '[]'),
    nowPlayingId: data.nowPlayingId || null,
    isPlaying: data.isPlaying === '1',
    startedAt: data.startedAt ? Number(data.startedAt) : null,
    progressAtPause: data.progressAtPause ? Number(data.progressAtPause) : null,
  };
}

// 방 재생 상태 저장 (HSET) — 전체 필드를 한 번에 기록
async function saveRoomState(roomCode, state) {
  await pubClient.hSet(roomKey(roomCode), {
    library: JSON.stringify(state.library ?? []),
    nowPlayingId: state.nowPlayingId ?? '',
    isPlaying: state.isPlaying ? '1' : '0',
    startedAt: state.startedAt != null ? String(state.startedAt) : '',
    progressAtPause: state.progressAtPause != null ? String(state.progressAtPause) : '',
  });
  await pubClient.expire(roomKey(roomCode), ROOM_TTL);
}

// 방이 없으면 초기 상태 생성
async function ensureRoom(roomCode) {
  if (await pubClient.exists(roomKey(roomCode))) return;
  await saveRoomState(roomCode, {
    // TODO: 테스트용 더미 트랙. 추후 upload_done으로만 채우도록 변경 예정
    library: [{ id: '1', title: 'lofi study beats vol.1', durationSec: 214 }],
    nowPlayingId: '1',
    isPlaying: true,
    startedAt: Date.now(),
    progressAtPause: null,
  });
}

// 참여자 추가 (HSET) — 첫 입장자를 방장으로
async function addParticipant(roomCode, socketId, nick) {
  const key = participantsKey(roomCode);
  // 원자적 방장 선점: ownerId 필드가 비어있을 때만 세팅됨 (HSETNX).
  // 동시 입장 시에도 정확히 한 명만 1을 돌려받아 race condition 방지.
  const claimed = await pubClient.hSetNX(roomKey(roomCode), 'ownerId', socketId);
  const isOwner = Boolean(claimed);
  await pubClient.hSet(key, socketId, JSON.stringify({ nick, isOwner }));
  await pubClient.expire(key, ROOM_TTL);
  return isOwner;
}

// 참여자 제거 (HDEL)
async function removeParticipant(roomCode, socketId) {
  await pubClient.hDel(participantsKey(roomCode), socketId);
}

// 참여자 목록 (HGETALL)
async function getParticipants(roomCode) {
  const map = await pubClient.hGetAll(participantsKey(roomCode));
  return Object.entries(map).map(([id, v]) => ({ id, ...JSON.parse(v) }));
}

// nowPlaying 전체 객체 (library에서 id로 조회)
function resolveNowPlaying(state) {
  if (!state.nowPlayingId) return null;
  return state.library.find((t) => t.id === state.nowPlayingId) ?? null;
}

io.on('connection', async (socket) => {
  // 연결 시 쿼리파라미터에서 roomCode, nick 추출
  const { roomCode, nick } = socket.handshake.query;

  // ── 방 입장 처리 ──
  await ensureRoom(roomCode);
  const isOwner = await addParticipant(roomCode, socket.id, nick);
  socket.join(roomCode);

  const state = await getRoomState(roomCode);
  const participants = await getParticipants(roomCode);
  console.log(`🟢 [${nick}] 입장 → 방 [${roomCode}] (현재 ${participants.length}명)${isOwner ? ' 👑방장' : ''}`);

  // 입장 직후 본인에게만 현재 방 전체 상태 전송 (중간 진입자 동기화 핵심)
  socket.emit('room_state', {
    selfId: socket.id,
    roomCode,
    participants,
    library: state.library,
    nowPlaying: resolveNowPlaying(state),
    isPlaying: state.isPlaying,
    startedAt: state.startedAt,
    progressAtPause: state.progressAtPause,
  });

  // 방 전체에 참여자 목록 업데이트 브로드캐스트
  io.to(roomCode).emit('participant_update', { participants });

  // ── play 이벤트 ──
  socket.on('play', async () => {
    console.log(`▶️  [${nick}] play → 방 [${roomCode}]`);
    const s = await getRoomState(roomCode);
    if (!s || !s.nowPlayingId) return;
    // 일시정지 상태에서 재개: 멈췄던 위치부터 시작하도록 startedAt 역산
    const startedAt = Date.now() - (s.progressAtPause ?? 0) * 1000;
    await saveRoomState(roomCode, { ...s, isPlaying: true, startedAt, progressAtPause: null });
    scheduleAutoAdvance(roomCode);
    io.to(roomCode).emit('playback_sync', {
      isPlaying: true,
      startedAt,
      progressAtPause: null,
      nowPlayingId: s.nowPlayingId,
    });
  });

  // ── pause 이벤트 ──
  socket.on('pause', async () => {
    console.log(`⏸️  [${nick}] pause → 방 [${roomCode}]`);
    const s = await getRoomState(roomCode);
    if (!s || !s.nowPlayingId || !s.isPlaying) return;
    const progressAtPause = (Date.now() - s.startedAt) / 1000;
    await saveRoomState(roomCode, { ...s, isPlaying: false, startedAt: null, progressAtPause });
    clearAutoAdvance(roomCode);
    io.to(roomCode).emit('playback_sync', {
      isPlaying: false,
      startedAt: null,
      progressAtPause,
      nowPlayingId: s.nowPlayingId,
    });
  });

  // ── skip 이벤트 ──
  socket.on('skip', async () => {
    console.log(`⏭️  [${nick}] skip → 방 [${roomCode}]`);
    await advanceTrack(roomCode);
  });

  // ── switch 이벤트 ──
  socket.on('switch', async ({ trackId }) => {
    const s = await getRoomState(roomCode);
    if (!s) return;
    const track = s.library.find((t) => t.id === trackId);
    if (!track) return socket.emit('error', { code: 'INVALID_TRACK' });
    const startedAt = Date.now();
    await saveRoomState(roomCode, { ...s, nowPlayingId: trackId, isPlaying: true, startedAt, progressAtPause: null });
    scheduleAutoAdvance(roomCode);
    io.to(roomCode).emit('track_changed', {
      nowPlayingId: trackId,
      isPlaying: true,
      startedAt,
      progressAtPause: null,
    });
  });

  // ── upload_done 이벤트 ──
  socket.on('upload_done', async ({ title, uploaderNick, durationSec, s3Key }) => {
    const s = await getRoomState(roomCode);
    if (!s) return;
    const newTrack = { id: Date.now().toString(), title, uploaderNick, durationSec, s3Key };
    const library = [...s.library, newTrack];
    let { nowPlayingId, isPlaying, startedAt, progressAtPause } = s;
    const wasEmpty = !nowPlayingId;
    // 첫 곡이면 자동으로 재생 시작
    if (wasEmpty) {
      nowPlayingId = newTrack.id;
      isPlaying = true;
      startedAt = Date.now();
      progressAtPause = null;
    }
    await saveRoomState(roomCode, { library, nowPlayingId, isPlaying, startedAt, progressAtPause });
    if (wasEmpty) scheduleAutoAdvance(roomCode);
    io.to(roomCode).emit('library_update', { library });
  });

  // ── 연결 종료 ──
  socket.on('disconnect', async () => {
    console.log(`🔴 [${nick}] 퇴장 → 방 [${roomCode}]`);
    await removeParticipant(roomCode, socket.id);
    const participants = await getParticipants(roomCode);
    if (participants.length === 0) {
      // 마지막 사람이 나가면 방 정리
      clearAutoAdvance(roomCode);
      await pubClient.del([roomKey(roomCode), participantsKey(roomCode)]);
    } else {
      io.to(roomCode).emit('participant_update', { participants });
    }
  });
});

// ── 곡 자동 전환 타이머 ──
// NOTE: 타이머는 이 서버 프로세스 메모리에 존재한다. 다중 서버 환경에선 같은 방에
//       서버마다 타이머가 걸려 track_changed가 중복 발송될 수 있음
//       → 추후 Redis 락(SETNX)으로 단일 서버만 타이머를 돌리도록 보완 필요.
const autoAdvanceTimers = new Map(); // roomCode → setTimeout id

async function scheduleAutoAdvance(roomCode) {
  clearAutoAdvance(roomCode);
  const s = await getRoomState(roomCode);
  if (!s || !s.nowPlayingId || !s.isPlaying) return;
  const track = s.library.find((t) => t.id === s.nowPlayingId);
  if (!track) return;
  const remaining = track.durationSec * 1000 - (Date.now() - s.startedAt);
  autoAdvanceTimers.set(roomCode, setTimeout(() => advanceTrack(roomCode), Math.max(remaining, 0)));
}

function clearAutoAdvance(roomCode) {
  const t = autoAdvanceTimers.get(roomCode);
  if (t) {
    clearTimeout(t);
    autoAdvanceTimers.delete(roomCode);
  }
}

async function advanceTrack(roomCode) {
  const s = await getRoomState(roomCode);
  if (!s) return;
  const idx = s.library.findIndex((t) => t.id === s.nowPlayingId);
  const next = s.library[idx + 1] ?? null;
  const startedAt = next ? Date.now() : null;
  await saveRoomState(roomCode, {
    ...s,
    nowPlayingId: next ? next.id : '',
    isPlaying: !!next,
    startedAt,
    progressAtPause: null,
  });
  clearAutoAdvance(roomCode);
  if (next) scheduleAutoAdvance(roomCode);
  io.to(roomCode).emit('track_changed', {
    nowPlayingId: next ? next.id : null,
    isPlaying: !!next,
    startedAt,
    progressAtPause: null,
  });
}

// ── Redis 연결 및 서버 실행 ──
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    console.log(`✅ Redis 연결 완료: ${REDIS_URL}`);

    // socket.io 어댑터를 Redis로 교체 → io.to(room).emit() 이 다중 서버에 자동 전파
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ socket.io Redis 어댑터 적용 완료 (다중 서버 브로드캐스트 활성화)');

    server.listen(PORT, () => {
      console.log(`🚀 서버 ${PORT} 포트에서 작동 (웹소켓 + Redis)`);
    });
  } catch (err) {
    console.error('❌ Redis 연결 실패, 서버를 시작할 수 없습니다:', err);
    process.exit(1);
  }
}

start();

// state 저장용으로 다른 모듈에서 재사용할 수 있도록 export (추후 분리 대비)
module.exports = { pubClient };
