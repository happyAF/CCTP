# Infra (Track C)

Docker, AWS, 배포 담당.

---

## 책임 영역

- Docker 이미지 빌드 (frontend / backend / Redis)
- AWS 셋업 — EC2, S3, ELB, IAM
- docker-compose 로컬 환경
- Auto-scaling 설정 + 부하 테스트
- 모니터링 대시보드 / 측정 리포트

---

## 진척 상황

### ✅ 완료 (5/19)
- [x] AWS 계정 + IAM 사용자 + 액세스 키
- [x] AWS CLI 설치 + 로그인
- [x] S3 버킷 생성 (`cctp-media-happyaf`)
- [x] Docker Desktop 설치

### ✅ 완료 (5/25)
- [x] **백엔드 Dockerfile** (`backend/Dockerfile`)
- [x] **백엔드 컨테이너 동작 확인** (S3 Presigned URL 발급 OK)

### ✅ 완료 (오늘)
- [x] **프론트엔드 Dockerfile** — Vite + React, 멀티스테이지 빌드 → nginx 정적 서빙
- [x] **nginx SPA 라우팅 설정** (`frontend/nginx.conf`)
- [x] **docker-compose.yml** — backend + frontend + redis 통합 실행
- [x] **로컬 통합 환경 완성** — `docker compose up` 한 번에 3개 컨테이너 다 뜸
- [x] Redis 연결 + Socket.io Redis 어댑터 동작 확인

### 🚧 다음 작업
- [ ] S3 CORS 설정 (브라우저에서 직접 PUT 하려면 필수)
- [ ] EC2 인스턴스 셋업 + Docker 설치
- [ ] EC2에 docker-compose 배포

### 📋 확장 목표
- [ ] Load Balancer + 멀티 EC2
- [ ] Auto-scaling
- [ ] 모니터링 대시보드

---

## AWS 리소스

| 항목 | 값 |
|---|---|
| 리전 | `ap-northeast-2` (Seoul) |
| 계정 ID | `586199468759` |
| IAM 로그인 URL | `https://586199468759.signin.aws.amazon.com/console` |
| S3 버킷 | `cctp-media-happyaf` |

---

## 로컬 개발 환경 셋업 (조원용 가이드)

### 필수 설치
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [AWS CLI v2](https://awscli.amazonaws.com/AWSCLIV2.msi) (개별 S3 조작용)
- Git Bash

### `.env` 파일 준비 (`backend/.env`)

```env
PORT=3000
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=본인키
AWS_SECRET_ACCESS_KEY=본인비밀키
AWS_S3_BUCKET_NAME=cctp-media-happyaf
REDIS_URL=redis://redis:6379
```

⚠️ `.env`는 절대 커밋 금지

---

## docker-compose 사용법

### 전체 환경 한 번에 띄우기

```bash
cd infra
docker compose up --build
```

3개 컨테이너 동시 실행:
- **redis** (port 6379) — Socket.io 어댑터용
- **backend** (port 3000) — Node.js + Express + Socket.io
- **frontend** (port 8080) — Vite + React 빌드 → nginx 서빙

### 백그라운드 실행

```bash
docker compose up -d --build
```

### 로그 보기

```bash
docker compose logs -f          # 전체
docker compose logs -f backend  # 특정 서비스만
```

### 컨테이너 중지

```bash
docker compose down
```

### 완전 초기화 (이미지까지 삭제)

```bash
docker compose down --rmi all -v
```

---

## 개별 동작 확인

### 백엔드만 빌드/실행
```bash
cd backend
docker build -t cctp-backend .
docker run -p 3000:3000 --env-file .env cctp-backend
```

### 프론트엔드만 빌드/실행
```bash
cd frontend
docker build -t cctp-frontend .
docker run -p 8080:80 cctp-frontend
```

### 동작 확인 URL
- 프론트엔드: `http://localhost:8080`
- 백엔드 API: `http://localhost:3000/api/upload-url?filename=test.mp3`
- (응답으로 S3 Presigned URL이 JSON 형식으로 나와야 정상)

---

## S3 CLI 사용법

```bash
# 업로드
aws s3 cp <로컬> s3://cctp-media-happyaf/<S3경로>

# 목록
aws s3 ls s3://cctp-media-happyaf/

# 다운로드
aws s3 cp s3://cctp-media-happyaf/<S3경로> <로컬>

# 삭제
aws s3 rm s3://cctp-media-happyaf/<S3경로>
```

---

## ⚠️ 보안

- 액세스 키, `.env` 파일은 절대 GitHub 커밋 금지
- `.gitignore`에 다 등록되어 있음
- 키가 노출되면 즉시 AWS 콘솔에서 비활성화 + 재발급
- 비밀값은 디스코드 비밀 채널이나 별도 안전한 채널로 공유

---

## 회의 때 결정 / 합의 필요한 사항

1. S3 CORS 정책 — A가 프론트에서 직접 PUT 호출 시작하기 전에 설정 필요
2. EC2 인스턴스 사양 — t3.small 정도? (프리티어 + 크레딧으로 충분)
3. 배포 방식 — EC2에 git pull + docker compose up 으로 갈지, 별도 자동화할지
