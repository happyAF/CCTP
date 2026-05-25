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

// 웹소켓 통신 로직 (방 관리 및 이벤트 동기화)
io.on('connection', (socket) => {
  console.log(`🟢 유저 접속됨! 소켓 ID: ${socket.id}`);

  // 1. 방 입장하기
  socket.on('join_room', (roomCode) => {
    socket.join(roomCode); // 해당 룸 코드의 방으로 유저를 넣음
    console.log(`소켓 ID [${socket.id}] 님이 방 [${roomCode}] 에 입장함`);
  });

  // 2. 동기화 이벤트(재생, 정지 등) 받아서 방 사람들에게 뿌리기
  socket.on('send_action', (data) => {
    // data 예시: { roomCode: 'A1B2', action: 'play', trackId: 'song_123' }
    
    //브로드캐스트
    socket.to(data.roomCode).emit('receive_action', data);
    
    console.log(`📢방 [${data.roomCode}] 에 이벤트 발송: ${data.action}`);
  });

  // 3. 유저가 탭을 닫거나 나갔을 때
  socket.on('disconnect', () => {
    console.log(`유저 접속 종료: ${socket.id}`);
  });
});

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 ${PORT} 포트에서 작동 (웹소켓 포함)`);
});