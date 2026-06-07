# ♪ 함께 듣는 음악 — 다중 접속 실시간 음악 동기화 웹 서비스

> AWS 환경에서 수평 확장을 지원하는 다중 접속 실시간 음악 동기화 웹 서비스
> 클라우드컴퓨팅 텀 프로젝트 | 분반 059

-----

## A. 프로젝트 명

**AWS 환경에서 수평 확장을 지원하는 다중 접속 실시간 음악 동기화 웹 서비스**

-----

## B. 프로젝트 멤버 및 담당 파트

|이름 |학번       |담당 파트                                                                                |
|---|---------|-------------------------------------------------------------------------------------|
|김재혁|202155535|Backend — WebSocket 서버(Socket.io), Redis Pub/Sub 어댑터, S3 Presigned URL API, 재생 동기화 로직|
|서혜민|202355544|Frontend — React/TypeScript UI, 음악 플레이어, 방 입장·업로드 화면, WebSocket 클라이언트 연동             |
|원재연|202355715|Infra — Docker/Docker Compose 구성, AWS EC2 배포, S3 버킷·IAM 설정                           |

-----

## C. 프로젝트 소개

사용자가 개설한 방에 MP3 파일을 업로드하면, 해당 방에 접속한 **모든 인원이 동일한 시점부터 동시에** 음악을 감상할 수 있는 실시간 웹 서비스입니다.

- 닉네임만 입력하면 별도 회원가입 없이 방을 만들거나 초대 링크로 입장할 수 있습니다.
- 누구나 MP3를 업로드하고 라이브러리에서 곡을 선택해 재생·일시정지·스킵·곡 전환을 제어할 수 있습니다.
- **Absolute-time 동기화** 방식으로 지각 입장자도 현재 재생 위치에 자동으로 싱크됩니다.
- 트래픽 증가 시 다중 EC2 환경으로 수평 확장(Scale-out)이 **가능하도록** Redis Pub/Sub 기반 분산 아키텍처로 설계하였습니다. (※ 실제 다중 인스턴스 배포는 확장 과제로 두었으며, 자세한 내용은 J. 한계 및 향후 과제 참조)

**GitHub**: <https://github.com/happyAF/CCTP>

-----

## D. 프로젝트 필요성 소개

기존의 단일 서버 기반 실시간 서비스는 사용자가 급증하면 트래픽과 장애에 취약합니다. 특정 세션으로 대규모 사용자가 순간적으로 집중되는 **트래픽 스파이크(Traffic Spike)** 현상이 발생할 경우, 단일 서버 환경에서는 특정 프로세스 및 네트워크 대역폭에 부하가 과밀되어 전체 시스템이 마비되는 치명적인 가용성 저하 문제가 발생합니다.

이를 해결하기 위해 **수평적 확장(Scale-out)** 과 부하 변동에 동적으로 대응하는 Auto-scaling 인프라 도입이 일반적인 해결책입니다. 본 프로젝트는 이러한 클라우드 컴퓨팅의 핵심 가치를 학습·실증하는 것을 목표로, **수평 확장이 즉시 가능한 아키텍처 기반**을 구축하는 데 중점을 두었습니다. (※ Auto-scaling 자체의 구현은 확장 과제로 남겼으며, J 섹션 참조)

### 주요 유스케이스

**액터**: 방장(Host), 참여자(Guest)

|단계         |내용                                                       |
|-----------|---------------------------------------------------------|
|1. 진입      |방장·참여자 모두 닉네임 입력 후 사이트 접속                                |
|2. 방 생성    |방장이 [방 만들기]를 클릭해 세션 개설, 고유 초대 링크 발급                      |
|3. 참여자 입장  |초대 링크로 입장 (※ 확장 시: 로드밸런서가 가용 WebSocket 서버로 분산 라우팅)       |
|4. 음악 업로드  |누구나 MP3 업로드. S3 Presigned URL로 서버 부하 없이 S3에 직접 PUT       |
|5. 재생 상태 저장|재생 명령 수신 시 서버가 Redis HSET으로 상태(track_id, started_at 등) 기록|
|6. 이벤트 발행  |Redis Pub/Sub 채널에 Publish (※ 확장 시: 분산된 다른 서버로 실시간 전파)    |
|7. 동시 재생   |Subscribe한 서버가 연결된 클라이언트에 WebSocket 명령 전송, 시차 보정 후 동시 재생 |
|8. 지각 합류   |Redis HGET으로 현재 재생 위치를 조회해 중간부터 자연스럽게 싱크                 |
|9. 실시간 제어  |누구나 일시정지·다음 곡·스킵 가능, Redis를 통해 즉시 동기화                    |
|10. 곡 전환   |라이브러리에서 다른 곡 클릭 시 전체에 브로드캐스트                             |

-----

## E. 관련 기술/논문/특허 조사

### 디스코드 뮤직봇

디스코드 음성 채널에 봇을 추가해 유튜브·스포티파이 등 외부 플랫폼 음원을 채널 접속자가 동시에 감상할 수 있게 지원하는 기능. 본 프로젝트는 외부 플랫폼 의존 없이 사용자가 직접 MP3를 올려 재생하는 방식으로 차별화됩니다.
→ <https://github.com/umutxyp/MusicBot>

### 오픈소스 아키텍처 레퍼런스: RedisWS-Hub

Node.js 기반 WebSocket 서버에 Redis Pub/Sub을 연동해, 다수의 사용자가 접속한 분산 환경에서 실시간 통신 및 이벤트 브로드캐스팅을 구현한 오픈소스 시스템 아키텍처 사례. 본 프로젝트 백엔드 설계의 레퍼런스로 참조하였습니다.
→ <https://github.com/skushagra9/RedisWS-Hub>

### Spotify Jam

유저들이 멀리 떨어져 있어도 실시간으로 같은 음악을 오차 없이 똑같이 들을 수 있게 해주는 소셜 리스닝 기능. 본 프로젝트는 Spotify 계정 없이 누구나 MP3를 업로드해 방을 만들 수 있는 독립형 서비스를 목표로 합니다.
→ <https://support.spotify.com/kr-ko/article/jam/>

-----

## F. 프로젝트 개발 결과물 소개

### 기술 스택

|분류      |기술                                                       |
|--------|---------------------------------------------------------|
|Frontend|React 18, TypeScript, Vite, socket.io-client, nginx      |
|Backend |Node.js, Express 5, Socket.io 4, @socket.io/redis-adapter|
|상태 저장소  |Redis 7 (Key-Value 재생 상태 + Pub/Sub 브로드캐스트)               |
|미디어 스토리지|AWS S3 (Presigned PUT/GET URL)                           |
|인프라     |AWS EC2 (t3.small, Ubuntu 22.04), Docker, Docker Compose |

### 폴더 구조

```
CCTP/
├── frontend/        # React SPA (Track A)
│   ├── src/
│   ├── Dockerfile   # Vite 빌드 → nginx 멀티스테이지
│   └── nginx.conf
├── backend/         # Node.js WebSocket 서버 (Track B)
│   ├── server.js    # 핵심 로직 (Socket.io + Redis + S3)
│   └── Dockerfile
├── infra/           # AWS · Docker 설정 문서 (Track C)
├── docs/            # 제안서, 회의록, WebSocket 프로토콜 명세
└── docker-compose.yml
```

### 핵심 구현 내용

#### 1. S3 Presigned URL 직접 업로드

클라이언트가 `/api/upload-url`로 60초 유효 Presigned PUT URL을 발급받아 S3에 직접 업로드합니다. 서버를 경유하지 않으므로 대용량 파일에도 백엔드 부하가 없습니다.

```
클라이언트 → GET /api/upload-url?filename=song.mp3
서버       → { uploadUrl: "https://s3.amazonaws.com/...(60초)" }
클라이언트 → PUT <uploadUrl>  (MP3 바이너리 직접 전송)
클라이언트 → WS: upload_done { title, durationSec, s3Key }
서버       → WS 브로드캐스트: library_update
```

#### 2. Absolute-time 동기화 (예비 재생)

재생 명령 수신 시 서버가 **서버 시각 기준**으로 `playAt = Date.now() + 2000ms`를 계산해 전 클라이언트에 브로드캐스트합니다. 2초의 버퍼는 네트워크 전파 지연을 흡수하기 위한 여유 시간입니다. 각 클라이언트는 `setTimeout(() => audio.play(), playAt - Date.now())`로 자신의 시계를 기준으로 재생 시각을 예약하므로, 클라이언트-서버 간 clock skew가 수십 ms 이내라면 2초 버퍼로 충분히 보정됩니다. (v1 한계: 수백 ms 이상의 clock skew는 별도 NTP 보정 없이 잡기 어렵습니다.)

지각 입장자는 `(Date.now() - startedAt) / 1000`으로 현재 재생 위치를 즉시 계산해 싱크됩니다.

#### 3. Redis 기반 다중 서버 브로드캐스트 (확장 대비)

`@socket.io/redis-adapter`로 Socket.io 어댑터를 Redis로 교체하였습니다. **현재는 단일 backend 인스턴스로 운영**되고 있으나, 본 어댑터 구성으로 인해 추가 backend 인스턴스를 띄우는 즉시 Redis Pub/Sub을 통해 **모든 서버에 연결된 전체 클라이언트**에 이벤트가 자동 전파됩니다. 즉 코드 변경 없이 수평 확장이 가능한 구조입니다.

#### 4. Redis Hash 재생 상태 영속

방의 재생 상태(`library`, `nowPlayingId`, `isPlaying`, `startedAt`, `playAt`, `progressAtPause`)를 Redis HASH에 저장합니다. TTL은 24시간으로, **마지막 활동(재생·일시정지·업로드 등) 시점으로부터 24시간 동안 활동이 없을 경우** 자동 만료됩니다. 마지막 사용자가 퇴장하면 즉시 방 키를 삭제하며, TTL은 그 전에 발생할 수 있는 좀비 키(비정상 종료 등)를 정리하기 위한 안전망으로 작동합니다.

### 시스템 아키텍처

본 프로젝트의 아키텍처는 두 가지 관점에서 설명합니다.

#### F-1) 현재 배포된 시스템 (단일 EC2)

```
                                    AWS Cloud
                                    
                                    ┌──────────────────────────────┐
                                    │       EC2 (t3.small)         │
                                    │                              │
   ┌────────────┐    HTTP/WS         │  ┌────────────────────────┐  │
   │ Browser 1  │ ─────────────────► │  │  Docker Compose Stack  │  │
   │ Browser 2  │ ─────────────────► │  │                        │  │
   │   ...      │                    │  │  ┌──────────┐          │  │
   └────────────┘                    │  │  │ frontend │ :8080    │  │
                                    │  │  │ (nginx)  │          │  │
                                    │  │  └──────────┘          │  │
                                    │  │       ↕                │  │
                                    │  │  ┌──────────┐          │  │
                                    │  │  │ backend  │ :3000    │  │
                                    │  │  │ (Node.js │          │  │
                                    │  │  │ +Socket.io)         │  │
                                    │  │  └────┬─────┘          │  │
                                    │  │       │                │  │
                                    │  │  ┌────▼─────┐          │  │
                                    │  │  │  redis   │ :6379    │  │
                                    │  │  └──────────┘          │  │
                                    │  └────────────────────────┘  │
                                    └──────────────┬───────────────┘
                                                   │
                                                   ▼
                                              ┌────────┐
                                              │   S3   │
                                              │(미디어)│
                                              └────────┘
```

EC2 1대 위에서 `docker compose up` 으로 3개 컨테이너가 동작합니다. Backend 인스턴스는 1개이며, Redis는 현재 단일 인스턴스 환경에서도 재생 상태 영속 저장소 및 Pub/Sub 어댑터 역할을 수행합니다.

#### F-2) 수평 확장 시 설계 (Multi-EC2 + ELB)

```
                     ┌──────────────────────────────────────────────────┐
                     │              AWS Cloud Infrastructure            │
                     │                                                  │
┌──────────────┐     │  ┌──────────────────────────────────────────┐    │
│  Browser 1   │     │  │   Backend Servers (Node.js / EC2)        │   │
│ (방장·업로더)   │     │  │   ※ REST API + WebSocket 동일 서버          │   │
└──────┬───────┘     │  │                                          │   │
       │             │  │  ┌───────────────┐  ┌───────────────┐    │   │
       │ HTTP/WS     │  │  │    WS-1       │  │    WS-2       │    │   │
       │ 요청         │  │  │  Express      │  │  Express      │    │   │
       ▼             │  │  │  Socket.io    │  │  Socket.io    │    │   │
┌──────────────┐     │  │  └──────┬────────┘  └──────┬────────┘    │   │
│     ELB      │────►│  │         │  @socket.io/      │            │   │
│ (로드밸런서)    │     │  │         │  redis-adapter    │            │   │
└──────────────┘     │  │         └──────────┬────────┘            │   │
                     │  │                    │                     │   │
                     │  │           ┌────────▼──────────┐          │   │
                     │  │           │       Redis       │          │   │
                     │  │           │  • HASH 재생 상태    │          │   │
                     │  │           │  • Pub/Sub 브로드캐스트│         │   │
                     │  │           └───────────────────┘          │   │
                     │  └──────────────────────────────────────────┘   │
                     │                                                  │
                     │  ┌──────────┐                                    │
                     │  │ Amazon   │◄─ ② S3 직접 PUT (MP3, Presigned)   │
                     │  │    S3    │─► ④ Presigned GET URL (재생)        │
                     │  └──────────┘                                    │
                     └──────────────────────────────────────────────────┘

[ 전체 흐름 ]
  ① 클라이언트 → ELB → WS-N: GET /api/upload-url  → Presigned PUT URL 발급
  ② 클라이언트 → S3 직접 PUT                        → MP3 업로드 (서버 무부하)
  ③ 클라이언트 → WS: upload_done                    → 서버 library 업데이트
  ④ 곡 전환 시 클라이언트 → GET /api/play-url       → Presigned GET URL 발급
  ⑤ 재생 명령 수신 시 WS-N → Redis HSET            → 재생 상태 저장
  ⑥ WS-N → Redis Publish                            → 타 서버로 이벤트 전파
  ⑦ 모든 WS → 연결 클라이언트에 WS 브로드캐스트     → 전원 동시 동기화

※ 본 다이어그램은 다중 EC2 확장 시의 설계입니다. 현재 배포된 시스템은 F-1과 같이 단일 EC2 인스턴스입니다.
※ REST(/api/upload-url, /api/play-url)와 WebSocket은 동일한 Node.js 프로세스에서 제공됩니다.
  ELB가 HTTP 요청과 WebSocket 업그레이드 요청을 모두 백엔드 서버로 라우팅합니다.
```

### WebSocket 이벤트 명세 (요약)

|방향   |이벤트                 |설명                                 |
|-----|--------------------|-----------------------------------|
|서버→클라|`room_state`        |입장 직후 전체 방 상태 (library, 재생 위치, 참여자)|
|클라→서버|`play` / `pause`    |재생 재개 / 일시정지                       |
|클라→서버|`skip`              |다음 곡으로 스킵                          |
|클라→서버|`switch`            |라이브러리에서 특정 곡으로 전환                  |
|클라→서버|`upload_done`       |S3 업로드 완료 후 곡 정보 등록                |
|서버→클라|`playback_sync`     |play/pause 후 전체 동기화 상태             |
|서버→클라|`track_changed`     |곡 전환 후 동기화                         |
|서버→클라|`library_update`    |새 곡 추가 시 전체 라이브러리                  |
|서버→클라|`participant_update`|입장·퇴장 시 참여자 목록                     |

-----

## G. 개발 결과물을 사용하는 방법

### 동작 환경

- **서버/인프라**: AWS EC2 (Ubuntu 22.04), Docker + Docker Compose, AWS S3, Redis 7
- **클라이언트**: HTML5 `<audio>` 및 WebSocket을 지원하는 PC/노트북/모바일 웹 브라우저 (별도 앱 설치 불필요)

### 서비스 사용 방법

1. 브라우저에서 배포된 서비스 URL에 접속
1. 닉네임 입력 후 **[방 만들기]** 또는 **[방 참여하기]** 선택
1. 방 코드를 팀원에게 공유
1. MP3 파일 업로드 → 공용 라이브러리에 자동 등록
1. 곡을 클릭해 재생 — 방에 있는 모든 인원이 동시에 같은 음악을 듣습니다

### 로컬 개발 환경 실행

#### 사전 준비

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
- `backend/.env` 파일 작성 (커밋 금지 — `.gitignore`에 등록됨)

```env
PORT=3000
AWS_REGION=<AWS 리전>
AWS_ACCESS_KEY_ID=<IAM 액세스 키>
AWS_SECRET_ACCESS_KEY=<IAM 시크릿 키>
AWS_S3_BUCKET_NAME=<S3 버킷 이름>
REDIS_URL=redis://redis:6379
```


#### 실행

```bash
# 레포 루트에서
docker compose up --build

# 프론트엔드: http://localhost:8080
# 백엔드 API: http://localhost:3000
```

#### 종료

```bash
docker compose down          # 종료
docker compose down -v       # 종료 + Redis 데이터 삭제
```

### EC2 배포 방법

```bash
# 1. EC2 SSH 접속
chmod 400 <키페어>.pem
ssh -i <키페어>.pem ubuntu@<EC2_PUBLIC_IP>

# 2. Docker 설치 (최초 1회)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
exit  # 재접속 필요

# 3. 레포 클론 + 환경 변수 작성 + 실행
git clone https://github.com/happyAF/CCTP.git
cd CCTP
nano backend/.env    # 위 형식 그대로 작성
docker compose up --build -d

# 4. 상태 확인
docker compose ps
docker compose logs -f

# 5. 코드 업데이트 후 재배포
git pull && docker compose up --build -d
```

#### 주요 트러블슈팅 (실제 겪은 이슈)

|증상                                                               |원인                        |해결                                                     |
|-----------------------------------------------------------------|--------------------------|-------------------------------------------------------|
|Redis 연결 실패 (`ECONNREFUSED 127.0.0.1:6379`)                      |컨테이너 네트워크에서 `localhost` 지정|`.env`의 `REDIS_URL`을 `redis://redis:6379`로 설정 (서비스명 사용)|
|EC2 외부 접속 불가                                                     |보안 그룹 인바운드 미설정            |AWS 보안 그룹에 포트 3000, 8080 인바운드 규칙 추가                    |
|SSH `Permission denied (publickey)`                              |키 파일 권한 과다                |`chmod 400 <키페어>.pem`                                  |
|컨테이너 이름 충돌 (`already in use`)                                    |이전 컨테이너 잔존                |`docker rm -f cctp-redis cctp-backend cctp-frontend`   |
|EC2 빌드 메모리 부족                                                    |t2.micro 메모리(1GB) 부족      |t3.small (2GB) 이상 사용                                   |
|S3 Presigned URL `No value provided for input HTTP label: Bucket`|`.env` 환경변수 누락 또는 줄바꿈 깨짐  |`backend/.env`에 `AWS_S3_BUCKET_NAME` 추가, 한 줄에 하나씩 작성   |
|브라우저에서 S3 PUT 실패 (CORS)                                          |S3 버킷 CORS 미설정            |S3 콘솔 → 권한 → CORS 정책에 PUT/GET 허용 추가                    |

-----

## H. 개발 결과물의 활용방안 소개

|활용 상황            |내용                                                              |
|-----------------|----------------------------------------------------------------|
|**소규모 그룹 음악 청취** |친구·동료와 같은 음악을 동시에 들으며 소셜 리스닝 파티                                 |
|**원격 스터디 BGM 공유**|스터디 그룹이 집중용 BGM을 공동으로 업로드하고 함께 재생                               |
|**방송·스트리밍 보조**   |라이브 방송의 배경음악을 시청자와 동기화해 재생                                      |
|**클라우드 아키텍처 학습** |Redis Pub/Sub + Socket.io 어댑터로 구성한 다중 서버 실시간 동기화 패턴의 레퍼런스       |
|**확장 적용**        |Auto-scaling + AWS ELB 구성을 추가하면 대규모 트래픽(공연 실황, 온라인 파티 등)에도 대응 가능|

본 서비스의 분산 아키텍처는 음악 동기화를 넘어, **실시간 공동 상태를 공유해야 하는 모든 도메인**(공동 편집, 온라인 보드게임, 라이브 퀴즈 등)에 그대로 적용할 수 있습니다.

-----

## I. AI 활용

### 사용한 AI 도구

|도구                                |주요 활용                                      |
|----------------------------------|-------------------------------------------|
|**Claude Code (Anthropic Claude)**|보일러플레이트 코드 생성, 에러 메시지 분석, 코드 리뷰, 단순 코딩 어시스트|

### AI 활용 비율 및 범위

본 프로젝트는 공지의 **“AI 활용 50% 미만”** 룰을 준수하였습니다. 공지에 명시된 바와 같이 단순 coding assist(자동완성, 코드 라인 단위 완성 등)는 제한 없이 사용 가능하며, 본 프로젝트의 AI 활용도 주로 이 범주에 해당합니다.

**팀원이 직접 수행한 영역 (50% 이상)**:

- 시스템 아키텍처 설계 및 기술 스택 선정
- 핵심 알고리즘 설계 (Absolute-time 동기화 로직, Redis HASH 재생 상태 모델링)
- AWS 인프라 셋업 (EC2, S3, IAM, 보안 그룹, CORS 정책)
- Docker 컨테이너 구성 결정 (멀티스테이지 빌드, healthcheck, 네트워크)
- 통합 테스트 및 실제 환경 디버깅 (`.env` 줄바꿈 이슈, CORS, Redis 연결 등)
- 팀 협업 (PR 리뷰, 충돌 해결, 일정 관리)

**AI 도움을 받은 영역**:

- Express/Socket.io 기본 셋업 등 보일러플레이트 코드
- AWS SDK v3 사용법 (Presigned URL 발급 코드 예시)
- Docker Compose YAML 작성 시 syntax 보조
- React 컴포넌트 구조 초안
- nginx SPA 라우팅 설정 작성
- 에러 메시지 해석 및 디버깅 방향 제시

AI가 생성한 코드는 모두 팀원이 직접 검토·수정하였으며, 실제 AWS 환경에서 동작을 확인하면서 발견된 이슈는 팀원이 직접 디버깅하였습니다. 특히 시스템 통합과 클라우드 배포 과정에서 발생한 문제(Redis 컨테이너 네트워크, S3 CORS, EC2 보안 그룹 설정 등)는 AI가 일반론적 답변만 제공할 수 있었기에 팀원의 실증적 판단과 트러블슈팅을 통해 해결하였습니다.

-----

## J. 한계 및 향후 과제

본 프로젝트는 다음 목표를 달성하였습니다:

- 단일 EC2 인스턴스 위 멀티 컨테이너 (frontend + backend + redis) 배포
- Stateless backend + Redis Pub/Sub 어댑터로 **수평 확장이 즉시 가능한 아키텍처 기반** 구축
- S3 공유 스토리지 + Presigned URL로 EC2 디스크 의존성 제거
- Absolute-time 동기화 알고리즘으로 다중 클라이언트 재생 시점 일치
- Docker 기반 재현 가능한 환경 (로컬/EC2 동일 명령어로 실행)

다만 시간 제약 및 본 프로젝트의 범위 설정에 따라 다음 항목은 확장 과제로 남겼습니다.

### J-1. Multi-EC2 + Load Balancer (미구현)

**현재**: EC2 1대에서 backend 컨테이너 1개로 운영.
**확장 가능성**: 본 시스템은 backend가 stateless(상태는 모두 Redis에 위임)이며 Socket.io의 Redis 어댑터로 다중 인스턴스 간 메시지 전파가 자동화되어 있습니다. 따라서 동일한 docker-compose 구성을 추가 EC2 인스턴스에 배포하고 AWS ELB(Application Load Balancer)로 트래픽을 분산하면 별도 코드 변경 없이 수평 확장이 가능합니다. ELB의 sticky session 설정으로 WebSocket의 stateful 특성도 처리할 수 있습니다.

### J-2. Auto-Scaling (미구현)

**현재**: 인스턴스 수 고정.
**확장 가능성**: AWS Auto Scaling Group + Launch Template + CloudWatch 메트릭(CPU 사용률, 동시 접속자 수)을 활용해 임계치 기반 자동 증감을 구성할 수 있습니다.

### J-3. 모니터링 및 부하 테스트 (미구현)

**현재**: `docker compose logs` 수준의 단순 로그 확인.
**확장 가능성**: CloudWatch + Grafana 대시보드로 실시간 메트릭 시각화, k6/Locust 등으로 부하 테스트 및 동기화 정확도 측정.

### J-4. 동기화 정확도 향상 (v1 한계)

현재 Absolute-time 동기화는 클라이언트-서버 간 clock skew가 수십 ms 이내일 때 효과적입니다. 수백 ms 이상의 skew에 대해서는 NTP-style의 RTT 측정 및 보정 알고리즘이 필요합니다.

### J-5. 보안 강화 (미구현)

**현재**: S3 CORS `AllowedOrigins: *`로 개발 편의 우선.
**확장 가능성**: 운영 환경에서는 특정 도메인으로 제한, IAM Role 기반 임시 자격증명, HTTPS/WSS 도입 등이 필요합니다.

-----

## 부록 — 비용 운영

본 프로젝트는 AWS 크레딧 환경에서 운영되었으며, EC2(t3.small, 시간당 약 $0.026) + S3(스토리지 1GB 미만) + 데이터 전송 비용을 합산해도 11일간 약 **$7 수준**으로 클라우드 기반 배포의 비용 효율성을 실증하였습니다.