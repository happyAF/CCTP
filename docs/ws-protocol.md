# WebSocket 메시지 프로토콜

> Frontend(A) 기준으로 정의한 메시지 명세.
> Backend(B)는 이 명세를 기준으로 서버를 구현하고, 변경이 필요하면 먼저 논의 후 이 문서를 업데이트.

---

## 연결

```
ws://<서버호스트>/ws?roomCode=<방코드>&nick=<닉네임>
```

- 쿼리 파라미터로 방 코드와 닉네임 전달
- 연결 성공 시 서버가 즉시 `room_state` 메시지 전송

---

## 메시지 포맷

모든 메시지는 JSON 문자열로 주고받는다.

```json
{ "type": "<이벤트명>", "payload": { ... } }
```

---

## 클라이언트 → 서버

### `upload_done`
MP3를 S3에 직접 업로드 완료한 뒤, 서버에 트랙 정보를 등록한다.

```json
{
  "type": "upload_done",
  "payload": {
    "title": "lofi study beats vol.1",
    "uploaderNick": "별이",
    "durationSec": 214,
    "s3Key": "uploads/1234567890_lofi.mp3"
  }
}
```

### `play`
일시정지 상태에서 재생을 재개할 때만 사용. 누구나 가능.

> 특정 곡을 처음 재생할 때는 `switch`를 사용하고,
> 곡 자동 전환은 서버가 `track_changed`로 브로드캐스트한다.

```json
{
  "type": "play",
  "payload": {}
}
```

### `pause`
일시정지를 요청한다. 누구나 가능.

```json
{
  "type": "pause",
  "payload": {}
}
```

### `skip`
현재 곡을 건너뛰고 다음 곡으로 넘긴다. 누구나 가능.

```json
{
  "type": "skip",
  "payload": {}
}
```

### `switch`
라이브러리에서 특정 곡을 즉시 전환한다. 누구나 가능.

```json
{
  "type": "switch",
  "payload": {
    "trackId": "3"
  }
}
```

---

## 서버 → 클라이언트 (브로드캐스트)

### `room_state`
입장 직후 1회 전송. 방 전체 상태를 초기화한다.

```json
{
  "type": "room_state",
  "payload": {
    "selfId": "p3",
    "roomCode": "ABC123",
    "participants": [
      { "id": "p1", "nick": "별이", "isOwner": true },
      { "id": "p2", "nick": "민준", "isOwner": false },
      { "id": "p3", "nick": "유진", "isOwner": false }
    ],
    "library": [
      { "id": "1", "title": "lofi study beats vol.1", "uploaderNick": "별이", "durationSec": 214, "s3Key": "uploads/111_lofi.mp3" },
      { "id": "2", "title": "rainy day jazz", "uploaderNick": "민준", "durationSec": 187, "s3Key": "uploads/222_jazz.mp3" }
    ],
    "nowPlaying": { "id": "1", "title": "lofi study beats vol.1", "uploaderNick": "별이", "durationSec": 214, "s3Key": "uploads/111_lofi.mp3" },
    "isPlaying": true,
    "startedAt": 1748390400000,
    "playAt": null,
    "progressAtPause": null
  }
}
```

> `selfId`: 본인의 participant id. 닉네임 중복 시에도 본인 식별 가능.  
> `startedAt`: 재생 중일 때만 유효. 일시정지 상태이면 `null`.  
> `playAt`: 예비 재생 게이트 시각(ms). 입장 시점이 `Date.now() < playAt`이면 아직 카운트다운 중이므로 그 시각까지 버퍼링만 하고 대기. 이미 재생 중이면 과거값이거나 `null`. (아래 `playback_sync` 설명 참고)  
> `progressAtPause`: 일시정지 중일 때 멈춘 위치(초). 재생 중이면 `null`.

일시정지 상태 예시:
```json
"isPlaying": false,
"startedAt": null,
"progressAtPause": 42
```

### `participant_update`
누군가 입장하거나 퇴장할 때 전체 참여자 목록을 다시 내려준다.

```json
{
  "type": "participant_update",
  "payload": {
    "participants": [
      { "id": "p1", "nick": "별이", "isOwner": true },
      { "id": "p2", "nick": "민준", "isOwner": false }
    ]
  }
}
```

### `playback_sync`
`play` / `pause` 수신 후 전송. 모든 클라이언트가 이 값으로 상태를 덮어쓴다.

```json
{
  "type": "playback_sync",
  "payload": {
    "isPlaying": true,
    "startedAt": 1748390402000,
    "playAt": 1748390402000,
    "progressAtPause": null,
    "nowPlayingId": "1"
  }
}
```

일시정지 시:
```json
{
  "type": "playback_sync",
  "payload": {
    "isPlaying": false,
    "startedAt": null,
    "playAt": null,
    "progressAtPause": 42,
    "nowPlayingId": "1"
  }
}
```

> 클라이언트에서 현재 재생 위치 계산: `progressSec = (Date.now() - startedAt) / 1000`  
> absolute time 방식이므로 주기적 동기화 불필요.

#### 예비 재생 (Preload & Ready) — `playAt`

`play` 이벤트 수신 시 서버는 **즉시 재생하지 않고** `playAt = now() + 2000ms`를 계산해 브로드캐스트한다.
모든 클라이언트가 2초간 버퍼링하고, `playAt` 시각에 **동시에** 재생을 시작해 네트워크 시차로 인한 오차를 제거한다.

- `startedAt = playAt - progressAtPause * 1000` 으로 역산됨 → `playAt` 시점에 정확히 멈췄던 위치가 되도록 보정.
- 클라이언트 동작:
  1. `playback_sync`(또는 `room_state`) 수신 시 `playAt`이 미래(`Date.now() < playAt`)면 → `<audio>` 버퍼링 + "준비 중..." UI, 소리는 내지 않음
  2. `audio.currentTime = (playAt - startedAt) / 1000` 로 시킹
  3. `playAt - Date.now()` ms 뒤에 `audio.play()` 예약 (`setTimeout`)
  4. `playAt`이 이미 과거면(지각 입장 등) → 즉시 `currentTime = (Date.now() - startedAt) / 1000` 후 재생
- `pause` / `switch` / `skip` / 곡 자동 전환 시 `playAt`은 `null` (예비 재생은 `play` 재개에만 적용. 곡 전환 즉시 재생은 v1 정책).

### `track_changed`
`skip` / `switch` / 곡 자동 전환 시 전송.

```json
{
  "type": "track_changed",
  "payload": {
    "nowPlayingId": "2",
    "isPlaying": true,
    "startedAt": 1748390500000,
    "progressAtPause": null
  }
}
```

> 곡이 바뀌면 클라이언트가 새 `nowPlayingId`의 `s3Key`를 이용해 `/api/play-url`을 호출하고 `<audio src>` 교체.

### `library_update`
새 트랙이 추가됐을 때 전체 라이브러리를 다시 내려준다.

```json
{
  "type": "library_update",
  "payload": {
    "library": [
      { "id": "1", "title": "lofi study beats vol.1", "uploaderNick": "별이", "durationSec": 214, "s3Key": "uploads/111_lofi.mp3" },
      { "id": "2", "title": "rainy day jazz", "uploaderNick": "민준", "durationSec": 187, "s3Key": "uploads/222_jazz.mp3" }
    ]
  }
}
```

### `error`
잘못된 요청 등 서버 오류.

```json
{
  "type": "error",
  "payload": {
    "code": "ROOM_NOT_FOUND",
    "message": "존재하지 않는 방입니다."
  }
}
```

에러 코드 목록:

| code | 설명 |
|---|---|
| `ROOM_NOT_FOUND` | 존재하지 않는 방 코드 |
| `INVALID_TRACK` | 라이브러리에 없는 trackId로 switch 요청 |
| `UPLOAD_FAILED` | S3 업로드 검증 실패 |
| `INTERNAL_ERROR` | 그 외 서버 오류 |

---

## S3 업로드 플로우

WebSocket이 아닌 REST API를 사용하는 파트.

```
1. 클라  →  GET /api/upload-url?filename=lofi.mp3
2. 서버  →  { "uploadUrl": "https://s3.amazonaws.com/...(presigned PUT, 60초)" }
3. 클라  →  PUT <uploadUrl>  (파일 바이너리 직접 전송, Content-Type: audio/mpeg)
4. 클라  →  WS: upload_done { title, uploaderNick, durationSec, s3Key }
5. 서버  →  WS 브로드캐스트: library_update
```

## S3 재생 플로우

곡 전환 시 클라이언트가 자동으로 호출.

```
1. nowPlayingId 변경 감지 (room_state / track_changed 수신)
2. 클라  →  GET /api/play-url?s3Key=uploads/111_lofi.mp3
3. 서버  →  { "playUrl": "https://s3.amazonaws.com/...(presigned GET, 3600초)" }
4. 클라  →  <audio src={playUrl}> 로 설정 후 재생
```

만료 정책: 3600초(1시간). 곡이 바뀔 때마다 새로 발급받으므로 갱신 로직 불필요.

---

## 타입 참조

```typescript
// frontend/src/types.ts 와 동일하게 유지

interface Track {
  id: string;
  title: string;
  uploaderNick: string;
  durationSec: number;
  s3Key: string; // presigned GET URL 발급용 (예: "uploads/1234567890_lofi.mp3")
}

interface Participant {
  id: string;
  nick: string;
  isOwner?: boolean;
}
```

---

## 동기화 정책 (Backend 구현 참고)

- **startedAt은 서버가 권위(source of truth)**: 클라이언트는 `(Date.now() - startedAt) / 1000`으로 재생 위치를 계산하며, `playback_sync` 수신 시 무조건 덮어씀
- **주기적 동기화 불필요**: absolute time 방식이므로 클라이언트가 언제 수신해도 정확한 위치를 계산 가능
- **곡 자동 전환**: 서버가 `Date.now() >= startedAt + durationSec * 1000` 감지 시 다음 곡으로 `track_changed` 브로드캐스트
- **방 ID**: 서버가 UUID 등으로 생성, roomCode(6자리 영숫자)는 입장용 human-readable 코드
- **권한**: 재생 / 일시정지 / 스킵 / 곡 전환 / MP3 업로드 — 누구나 가능 (기획서 시나리오 기준, v1)

---

## TBD: Backend 확정 필요 항목

| 항목 | 추천 옵션 | 비고 |
|---|---|---|
| 닉네임 중복 처리 | 허용 (selfId로 구분) | - |
| 방 삭제 / 강퇴 권한 | 미구현 | 방장만 하는 것도 가능 |
| 방장 퇴장 시 권한 이전 |방 종료 처리 | 또는 가장 먼저 입장한 다음 사람 |
| 마지막 곡 종료 후 동작 | `nowPlaying=null` + 정지 | 현재 mock 동작과 동일 |
