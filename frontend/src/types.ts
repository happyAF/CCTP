export interface Track {
  id: string;
  title: string;
  uploaderNick: string;
  durationSec: number;
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
