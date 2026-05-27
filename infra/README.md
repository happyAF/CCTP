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

### ✅ 완료
- [x] AWS 계정 생성 + 활성화
- [x] 결제 알림 (Zero spend budget) 설정
- [x] IAM 사용자 생성 (관리자 권한 분리)
- [x] IAM 사용자 액세스 키 발급
- [x] AWS CLI 설치 + 로그인 (`aws configure`)
- [x] S3 버킷 생성 (`cctp-media-happyaf`)
- [x] S3 업로드 동작 확인 (test.mp3)
- [x] Docker Desktop 설치
- [x] Docker 동작 확인 (nginx 테스트)

### 🚧 다음 미팅 후 (B/A 합의 필요)
- [ ] 백엔드 Dockerfile (B가 언어 정해야 함 — Python/Node)
- [x] 프론트엔드 빌드 방식 확정 → **아래 "프론트엔드 빌드 방식" 섹션 참조**
- [ ] 프론트엔드 Dockerfile 작성 (방식 확정됐으니 C가 작성 가능)
- [ ] `docker-compose.yml` 작성

### 📋 그 다음
- [ ] S3 CORS 설정 (브라우저에서 직접 접근용)
- [ ] EC2 인스턴스 셋업 + Docker 설치
- [ ] EC2에 docker-compose 배포
- [ ] (확장 목표) Load Balancer
- [ ] (확장 목표) Auto-scaling
- [ ] (확장 목표) 모니터링 대시보드

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

## 로컬 개발 환경

### 필수 설치
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — WSL2 기반
- [AWS CLI v2](https://awscli.amazonaws.com/AWSCLIV2.msi)
- Git Bash (Git for Windows)

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

### Docker 동작 확인

```bash
docker --version
docker compose version

# nginx 테스트
docker run -d -p 8080:80 --name test-nginx nginx
# 브라우저 http://localhost:8080 확인
docker stop test-nginx && docker rm test-nginx
```

---

## S3 사용법

### 파일 업로드
```bash
aws s3 cp <로컬파일경로> s3://cctp-media-happyaf/<S3경로>
```

### 파일 목록 보기
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
- `.gitignore`에 `*.csv`, `aws-credentials*`, `.env` 등 모두 등록됨
- 실수로 키가 공개되면 즉시 AWS 콘솔에서 키 비활성화 + 새 키 발급
- 비밀값은 디스코드 비밀 채널이나 별도 안전한 채널로 공유

---

## 프론트엔드 빌드 방식 ✅ 확정

| 항목 | 값 |
|---|---|
| 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite 5 |
| 빌드 명령 | `npm run build` (`tsc && vite build`) |
| 산출물 위치 | `frontend/dist/` |
| 서빙 방식 | nginx 정적 파일 서빙 (`dist/` 폴더를 document root로) |
| 컨테이너 포트 | 80 (nginx 기본) |

### 프론트엔드 Dockerfile 참고 구조

```dockerfile
# 1단계: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: nginx 서빙
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# SPA 라우팅 지원 (react-router-dom) — /room/:roomCode 같은 경로 처리
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` (SPA용 — 404를 index.html로 fallback):
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 회의 때 결정 필요한 사항

1. **백엔드 언어** — Python (FastAPI) vs Node.js (Express)
2. ~~**프론트엔드 빌드 방식**~~ — ✅ 확정 (위 섹션 참조)
3. **로컬 개발 시 docker-compose 구조** — 백엔드 언어 결정 후
