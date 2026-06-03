# Node.js 20 LTS slim 베이스
FROM node:20-slim

# 작업 디렉토리
WORKDIR /app

# 의존성 먼저 복사 (캐싱 최적화)
COPY package*.json ./

# 의존성 설치 (production만)
RUN npm ci --omit=dev

# 소스 코드 복사
COPY . .

# 컨테이너 노출 포트
EXPOSE 3000

# 서버 실행
CMD ["node", "server.js"]
