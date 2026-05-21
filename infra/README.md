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
- [ ] 프론트엔드 Dockerfile (A가 빌드 도구 정해야 함)
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

## 회의 때 결정 필요한 사항

1. **백엔드 언어** — Python (FastAPI) vs Node.js (Express)
2. **프론트엔드 빌드 방식** — vanilla JS (nginx 정적) vs React (빌드 후 nginx)
3. **로컬 개발 시 docker-compose 구조** — 위 두 결정 후
