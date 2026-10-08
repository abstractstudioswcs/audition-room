// Note names use scientific pitch: middle C is C4.

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number for a note name like "Bb3", "F#5" or "C4", or null if it can't be read. */
export function midi(note: string | null | undefined): number | null {
  if (!note) return null;
  const m = String(note).trim().match(/^([A-Ga-g])\s*([#♯b♭]?)\s*(-?\d)$/);
  if (!m) return null;
  let v = PITCH_CLASS[m[1].toUpperCase()] + 12 * (parseInt(m[3], 10) + 1);
  if (m[2] === "#" || m[2] === "♯") v++;
  if (m[2] === "b" || m[2] === "♭") v--;
  return v;
}

/** True when the text is empty or a readable note name. */
export function isNoteOrEmpty(note: string | null | undefined): boolean {
  return !note || !note.trim() || midi(note) !== null;
}

export type FitKind = "full" | "partial" | "none" | "unknown";
export type Fit = { kind: FitKind; text: string };

/** How many half steps a singer can miss by and still count as a partial fit. */
const PARTIAL_LIMIT = 4;

/**
 * Compare a singer's logged range with a character's needed range.
 * Either end of the character's range may be missing ("up to G5" alone is fine).
 */
export function fit(
  singerLow: number | null,
  singerHigh: number | null,
  roleLow: number | null,
  roleHigh: number | null,
): Fit {
  if (roleLow === null && roleHigh === null) return { kind: "unknown", text: "No range set" };
  if (singerLow === null || singerHigh === null) return { kind: "unknown", text: "Range not logged" };
  const lowShort = roleLow === null ? 0 : singerLow - roleLow;
  const highShort = roleHigh === null ? 0 : roleHigh - singerHigh;
  if (lowShort <= 0 && highShort <= 0) return { kind: "full", text: "Full fit" };
  const outside =
    (roleLow !== null && singerHigh < roleLow) || (roleHigh !== null && singerLow > roleHigh);
  if (outside || lowShort > PARTIAL_LIMIT || highShort > PARTIAL_LIMIT) return { kind: "none", text: "Not a fit" };
  if (lowShort > 0 && highShort > 0) return { kind: "partial", text: "Short both ends" };
  if (lowShort > 0) return { kind: "partial", text: `Low end short by ${lowShort}` };
  return { kind: "partial", text: `Top short by ${highShort}` };
}

/** Convenience wrapper taking note names. */
export function fitNotes(
  singer: { low?: string | null; high?: string | null },
  role: { low?: string | null; high?: string | null },
): Fit {
  return fit(midi(singer.low), midi(singer.high), midi(role.low), midi(role.high));
}

export const fitRank = (f: Fit) => (f.kind === "full" ? 0 : f.kind === "partial" ? 1 : 2);

/** "Tenor, up to G4" style summary of what a character needs. */
export function roleSpec(r: { voice?: string; low_note?: string; high_note?: string }): string {
  const lo = r.low_note?.trim(), hi = r.high_note?.trim();
  const range = lo && hi ? `${lo} to ${hi}` : hi ? `up to ${hi}` : lo ? `down to ${lo}` : "";
  return [r.voice, range].filter(Boolean).join(", ");
}

export const VOICES = ["Soprano", "Mezzo", "Alto", "Tenor", "Baritone", "Bass"] as const;

/** Range-bar axis, G2 to D6. */
export const AXIS_LOW = 43;
export const AXIS_HIGH = 86;
export const axisPct = (m: number) =>
  Math.max(0, Math.min(100, ((m - AXIS_LOW) / (AXIS_HIGH - AXIS_LOW)) * 100));
