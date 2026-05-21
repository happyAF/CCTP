require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
app.use(cors());
app.use(express.json());

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

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 ${PORT} 포트에서 작동`);
});