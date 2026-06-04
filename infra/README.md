# Infra (Track C)

Docker, AWS, 배포 담당.

---

## 🚀 배포 정보

**Live URL**:
- 프론트엔드: http://13.211.159.178:8080
- 백엔드 API: http://13.211.159.178:3000

**환경**:
- AWS EC2 (`t3.small`, Ubuntu 22.04)
- Docker + Docker Compose
- AWS S3 (미디어 저장)
- Redis (Socket.io 어댑터, 멀티서버 동기화 기반)

---

## 진척 상황

### ✅ 완료
- [x] AWS 계정 + IAM 사용자 + 액세스 키
- [x] AWS CLI 설치 + 로그인
- [x] S3 버킷 생성 (`cctp-media-happyaf`)
- [x] Docker Desktop (로컬 개발)
- [x] **백엔드 Dockerfile**
- [x] **프론트엔드 Dockerfile** (Vite 멀티스테이지 → nginx)
- [x] **nginx SPA 라우팅 설정**
- [x] **docker-compose.yml** (frontend + backend + redis 통합)
- [x] 로컬 통합 동작 확인
- [x] **EC2 인스턴스 생성 + 배포**
- [x] **보안 그룹 설정** (22/80/3000/8080)
- [x] **외부 접속 동작 확인**

### 🚧 남은 작업 (~6/7)
- [ ] S3 CORS 설정 (프론트에서 직접 PUT 시작 시 필요)
- [ ] 통합 데모 시나리오 테스트 (방 2개, 음악 동기화)
- [ ] 보고서 인프라 섹션 작성
- [ ] 데모 영상 인프라 파트 촬영

### 📋 확장 목표 (시간 되면)
- [ ] Multi-EC2 + Load Balancer
- [ ] Auto-scaling
- [ ] CloudWatch 모니터링

---

## AWS 리소스

| 항목 | 값 |
|---|---|
| 리전 | `ap-northeast-2` (Seoul) |
| 계정 ID | `586199468759` |
| IAM 로그인 URL | `https://586199468759.signin.aws.amazon.com/console` |
| S3 버킷 | `cctp-media-happyaf` |
| EC2 인스턴스 | `cctp-server` (t3.small, Ubuntu 22.04) |
| EC2 퍼블릭 IP | `13.211.159.178` |
| 보안 그룹 | `cctp-sg` (22, 80, 3000, 8080 인바운드) |
| 키 페어 | `cctp-key.pem` |

---

## 시스템 아키텍처

```
        [ 사용자 브라우저 ]
                ↓
       http://13.211.159.178:8080
                ↓
┌───────────── EC2 (t3.small) ─────────────┐
│                                          │
│   ┌──────────┐  ┌──────────┐  ┌───────┐ │
│   │ frontend │  │ backend  │  │ redis │ │
│   │ (nginx)  │──│(Node.js +│──│       │ │
│   │  :80     │  │socket.io)│  │ :6379 │ │
│   │          │  │  :3000   │  │       │ │
│   └──────────┘  └────┬─────┘  └───────┘ │
│                      │                   │
└──────────────────────┼───────────────────┘
                       │
                       ▼
                  ┌─────────┐
                  │ AWS S3  │
                  │(미디어) │
                  └─────────┘
```

---

## 로컬 개발 환경 셋업 (조원용)

### 필수 설치
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git Bash (Windows)
- (선택) [AWS CLI v2](https://awscli.amazonaws.com/AWSCLIV2.msi) — 개별 S3 조작용

### `backend/.env` 준비

```env
PORT=3000
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=본인키
AWS_SECRET_ACCESS_KEY=본인비밀키
AWS_S3_BUCKET_NAME=cctp-media-happyaf
REDIS_URL=redis://redis:6379
```

⚠️ `.env`는 절대 커밋 금지 (gitignore 등록됨)

### 실행

```bash
# 레포 루트에서
docker compose up --build
```

- 프론트: http://localhost:8080
- API: http://localhost:3000/api/upload-url?filename=test.mp3

### 종료

```bash
docker compose down
docker compose down -v  # Redis 데이터까지 삭제
```

---

## EC2 배포 가이드

### 1. EC2 인스턴스 사양
- AMI: Ubuntu 22.04 LTS
- 유형: t3.small (RAM 2GB)
- 스토리지: 20GB gp3
- 키 페어: RSA, .pem

### 2. 보안 그룹
| 포트 | 용도 |
|---|---|
| 22 | SSH |
| 80 | (예비) |
| 3000 | 백엔드 API |
| 8080 | 프론트엔드 |

### 3. SSH 접속
```bash
chmod 400 cctp-key.pem
ssh -i cctp-key.pem ubuntu@13.211.159.178
```

### 4. EC2 환경 셋업
```bash
# 시스템 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
exit  # 재접속 필요

# 다시 SSH 접속 후
docker --version
docker compose version
```

### 5. 레포 clone + 실행
```bash
git clone https://github.com/happyAF/CCTP.git
cd CCTP

# .env 작성
nano backend/.env  # 위 형식 그대로

# 빌드 + 실행 (백그라운드)
docker compose up --build -d

# 상태 확인
docker compose ps
docker compose logs -f
```

### 6. 외부 접속
브라우저에서 EC2 퍼블릭 IP로:
- http://13.211.159.178:8080
- http://13.211.159.178:3000/api/upload-url?filename=test.mp3

---

## 컨테이너 관리 명령어

```bash
# 상태 보기
docker compose ps

# 로그 보기 (실시간)
docker compose logs -f
docker compose logs -f backend   # 특정 서비스만

# 재시작
docker compose restart
docker compose restart backend

# 코드 업데이트 후 재배포
git pull
docker compose up --build -d

# 완전 종료
docker compose down
```

---

## ⚠️ 보안

- 액세스 키, `.env`, `.pem` 파일은 절대 GitHub 커밋 금지
- `.gitignore`에 다 등록됨
- 키가 노출되면 즉시 AWS 콘솔에서 비활성화 + 재발급
- EC2 SSH 키는 별도 안전한 곳에 보관
- 발표/평가 끝나면 EC2 인스턴스 중지 또는 종료 (비용 절감)

---

## 트러블슈팅 (실제 겪은 이슈)

### Docker Desktop 안 켜져있음 → 빌드 실패
→ 시작 메뉴에서 Docker Desktop 실행

### 컨테이너 이름 충돌 (`already in use`)
→ `docker rm -f cctp-redis cctp-backend cctp-frontend`

### EC2 SSH 접속 안 됨 (Permission denied)
→ `.pem` 파일 권한 잠그기: `chmod 400 cctp-key.pem`

### EC2 외부 접속 안 됨
→ 보안 그룹 인바운드 규칙 확인 (3000, 8080 열려있는지)

### Redis 연결 실패 (`ECONNREFUSED 127.0.0.1:6379`)
→ `.env`의 `REDIS_URL`을 `redis://redis:6379`로 (컨테이너 네트워크에선 서비스명 사용)

### npm 빌드 메모리 부족 (EC2)
→ t2.micro로는 빠듯. t3.small 이상 권장
