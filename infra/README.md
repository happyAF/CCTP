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
- [x] AWS 계정 생성 + 활성화
- [x] 결제 알림 (Zero spend budget) 설정
- [x] IAM 사용자 생성 (관리자 권한 분리)
- [x] IAM 사용자 액세스 키 발급
- [x] AWS CLI 설치 + 로그인 (`aws configure`)
- [x] S3 버킷 생성 (`cctp-media-happyaf`)
- [x] S3 업로드 동작 확인
- [x] Docker Desktop 설치
- [x] Docker 동작 확인 (nginx 테스트)

### ✅ 완료 (5/25)
- [x] **백엔드 Dockerfile 작성** (`backend/Dockerfile`)
- [x] **`.dockerignore` 작성** — `node_modules`, `.env` 등 제외
- [x] **백엔드 이미지 빌드 성공** (`cctp-backend:latest`)
- [x] **컨테이너 실행 + AWS 연동 통합 동작 확인**
  - `docker run -p 3000:3000 --env-file .env cctp-backend`
  - `GET /api/upload-url?filename=test.mp3` → S3 Presigned URL 정상 발급

### 🚧 다음 작업
- [ ] 프론트엔드 Dockerfile (A가 빌드 도구 정해야 함)
- [ ] `docker-compose.yml` 작성 (위 끝나면 바로)
- [ ] S3 CORS 설정 (브라우저에서 직접 PUT 하려면 필수)
- [ ] EC2 인스턴스 셋업
- [ ] EC2에 docker-compose 배포

### 📋 확장 목표
- [ ] Load Balancer
- [ ] Auto-scaling
- [ ] 모니터링 대시보드

---

## AWS 리소스 정보

| 항목 | 값 |
|---|---|
| 리전 | `ap-northeast-2` (Seoul) |
| 계정 ID | `586199468759` |
| IAM 로그인 URL | `https://586199468759.signin.aws.amazon.com/console` |
| S3 버킷 | `cctp-media-happyaf` |

### IAM 사용자 권한
- `AmazonS3FullAccess`
- `AmazonEC2FullAccess`
- `IAMUserChangePassword`

---

## 로컬 개발 환경 셋업

### 필수 설치
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — WSL2 기반
- [AWS CLI v2](https://awscli.amazonaws.com/AWSCLIV2.msi)
- Git Bash (Git for Windows)
- Node.js 20+ (백엔드 로컬 실행 시)

### AWS CLI 설정 (조원 각자 본인 키로)

```bash
aws configure
# AWS Access Key ID: (csv에서 복사)
# AWS Secret Access Key: (csv에서 복사)
# Default region name: ap-northeast-2
# Default output format: json
```

확인:
```bash
aws sts get-caller-identity
```

---

## 백엔드 Docker 사용법

### `.env` 파일 준비 (`backend/.env`)

```env
PORT=3000
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=본인키
AWS_SECRET_ACCESS_KEY=본인비밀키
AWS_S3_BUCKET_NAME=cctp-media-happyaf
```

⚠️ `.env` 파일은 절대 커밋 금지 (`.gitignore`에 등록됨)

### 빌드

```bash
cd backend
docker build -t cctp-backend .
```

### 실행

```bash
docker run -p 3000:3000 --env-file .env cctp-backend
```

### 동작 확인

브라우저 또는 curl:
```
http://localhost:3000/api/upload-url?filename=test.mp3
```

→ JSON 형태의 S3 Presigned URL 반환되면 정상

### 컨테이너 끄기

실행 중인 터미널에서 `Ctrl + C`

---

## S3 사용법 (CLI 직접 조작용)

### 파일 업로드
```bash
aws s3 cp <로컬파일경로> s3://cctp-media-happyaf/<S3경로>
```

### 파일 목록
```bash
aws s3 ls s3://cctp-media-happyaf/
```

### 파일 다운로드
```bash
aws s3 cp s3://cctp-media-happyaf/<S3경로> <로컬경로>
```

### 파일 삭제
```bash
aws s3 rm s3://cctp-media-happyaf/<S3경로>
```

---

## ⚠️ 보안 주의사항

- **액세스 키 csv 파일은 절대 GitHub에 커밋 금지**
- `.env` 파일도 마찬가지 (`.gitignore`에 등록됨)
- 실수로 키가 공개되면 즉시 AWS 콘솔에서 키 비활성화 + 새 키 발급
- 비밀값은 디스코드 비밀 채널이나 별도 안전한 채널로 공유

---

## 회의 때 결정 필요한 사항

1. **프론트엔드 빌드 방식** — vanilla JS (nginx 정적) vs React (빌드 후 nginx) → Dockerfile 작성 가능해짐
2. **docker-compose 구조** — 위 결정 후 바로 작성 가능
3. **S3 CORS 설정 시점** — A가 프론트에서 직접 PUT 호출 시작하면 그 전에
