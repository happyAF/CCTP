# ===== 1단계: 빌드 =====
FROM node:20-slim AS builder

WORKDIR /app

# 의존성 먼저 (캐싱 최적화)
COPY package*.json ./
RUN npm ci

# 소스 복사 + 빌드
COPY . .
RUN npm run build

# ===== 2단계: nginx 정적 서빙 =====
FROM nginx:alpine

# 빌드 결과만 가져오기
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA 라우팅 처리용 nginx 설정 (react-router 쓸 거라 필요)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
