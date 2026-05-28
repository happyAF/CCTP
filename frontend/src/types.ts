export interface Track {
  id: string;
  title: string;
  uploaderNick: string;
  durationSec: number;
  s3Key: string; // presigned GET URL 발급용 (예: "uploads/1234567890_lofi.mp3")
}

export interface Participant {
  id: string;
  nick: string;
  isOwner?: boolean;
}

export interface RoomState {
  roomCode: string;
  participants: Participant[];
  library: Track[];
  nowPlaying: Track | null;
  isPlaying: boolean;
  progressSec: number;
}
