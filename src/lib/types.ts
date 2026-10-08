export type Theatre = { id: string; name: string; team_code: string; created_by: string };
export type Member = { theatre_id: string; user_id: string; role: "owner" | "staff" };
export type Production = { id: string; theatre_id: string; title: string; created_at: string };

export type Character = {
  id: string;
  production_id: string;
  name: string;
  voice: string;
  low_note: string;
  high_note: string;
  notes: string;
  sort: number;
};

export type Session = {
  id: string;
  production_id: string;
  name: string;
  checkin_code: string;
  checkin_open: boolean;
  current_auditioner_id: string | null;
  created_at: string;
};

export type MusicFile = { path: string; name: string; type: string };
export type MusicType = "sheet" | "track" | "link" | "phone";

export type Auditioner = {
  id: string;
  session_id: string;
  slot: number;
  name: string;
  song: string;
  show: string;
  music_type: MusicType;
  files: MusicFile[];
  track_link: string;
  cut_start: string;
  cut_end: string;
  song_key: string;
  first_note: string;
  tempo: number | null;
  note: string;
  character_ids: string[];
  status: "waiting" | "singing" | "done";
  created_at: string;
};

export type Score = {
  auditioner_id: string;
  voice: string;
  low_note: string;
  high_note: string;
  belt_note: string;
  rating: number | null;
  notes: string;
  callback_ids: string[];
  updated_at: string;
};

export type Casting = {
  character_id: string;
  auditioner_id: string;
  status: "considering" | "cast";
  note: string;
  created_at: string;
};

export type CheckinInfo = {
  session_id: string;
  open: boolean;
  production: string;
  theatre: string;
  characters: { id: string; name: string }[];
};

export const MUSIC_LABEL: Record<MusicType, string> = {
  sheet: "sheet music",
  track: "backing track",
  link: "track link",
  phone: "track on phone",
};

export function missingMusic(a: Auditioner): boolean {
  if (a.music_type === "sheet" || a.music_type === "track") return a.files.length === 0;
  if (a.music_type === "link") return !a.track_link;
  return false;
}

/** Upload limits shared by the check-in form and the upload API. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 8;
export const SHEET_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav"];
