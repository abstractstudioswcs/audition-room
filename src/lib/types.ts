export type Theatre = { id: string; name: string; team_code: string; created_by: string };
export type Member = { theatre_id: string; user_id: string; role: "owner" | "staff" };
export type Production = { id: string; theatre_id: string; title: string; rehearsal_info: string; created_at: string };

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
  headshot_path: string;
  conflicts: Conflict[];
  conflict_notes: string;
  no_conflicts: boolean;
  created_at: string;
};

export type EventKind = "rehearsal" | "tech" | "performance" | "other";

/** A date on the rehearsal calendar. Times are "HH:MM" or blank. */
export type RehearsalEvent = {
  id: string;
  production_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  kind: EventKind;
  title: string;
  notes: string;
};

/** A hard rehearsal conflict. start and end are "HH:MM", or blank for all day. */
export type Conflict = { date: string; start: string; end: string; note: string };

export type Score = {
  auditioner_id: string;
  voice: string;
  low_note: string;
  high_note: string;
  belt_note: string;
  rating: number | null;
  notes: string;
  callback_ids: string[];
  acting_rating: number | null;
  acting_notes: string;
  updated_at: string;
};

export type Casting = {
  character_id: string;
  auditioner_id: string;
  status: "considering" | "callback" | "cast";
  note: string;
  created_at: string;
};

export type CheckinInfo = {
  session_id: string;
  open: boolean;
  production: string;
  theatre: string;
  rehearsal_info: string;
  characters: { id: string; name: string }[];
  events?: RehearsalEvent[];
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
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // sheet music
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // WAV runs about 10 MB a minute
export const MAX_FILES = 8;
export const SHEET_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav"];

export const maxBytesFor = (type: string) => (type.startsWith("audio/") ? MAX_AUDIO_BYTES : MAX_FILE_BYTES);

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
};
const ALIASES: Record<string, string> = {
  "audio/wave": "audio/wav", "audio/vnd.wave": "audio/wav", "audio/x-pn-wav": "audio/wav",
  "audio/mp3": "audio/mpeg", "audio/x-mp3": "audio/mpeg", "audio/x-mpeg": "audio/mpeg",
};

/**
 * One standard type per file. Browsers label WAV and MP3 several ways, and
 * some send no type at all, so fall back to the file extension.
 */
export function normalizeType(name: string, type: string): string {
  const t = (type || "").toLowerCase().split(";")[0].trim();
  if (t && ALIASES[t]) return ALIASES[t];
  if (t && t !== "application/octet-stream") return t;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return BY_EXTENSION[ext] ?? t;
}
