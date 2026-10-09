import type { Auditioner, Conflict } from "./types";

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Tue, Nov 3" from "2026-11-03", treating the date as a calendar day (no time zone shifts). */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : DAY.format(d);
}

/** "6:00 pm" from "18:00". */
export function formatTime(t: string): string {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return t;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

/** "All day" or "6:00 pm to 9:00 pm" or "from 6:00 pm". */
export function formatSpan(c: Pick<Conflict, "start" | "end">): string {
  if (!c.start && !c.end) return "All day";
  if (c.start && c.end) return `${formatTime(c.start)} to ${formatTime(c.end)}`;
  return c.start ? `from ${formatTime(c.start)}` : `until ${formatTime(c.end)}`;
}

/** "Tue, Nov 3, 6:00 pm to 9:00 pm (Work)". */
export function formatConflict(c: Conflict): string {
  return `${formatDay(c.date)}, ${formatSpan(c)}${c.note ? ` (${c.note})` : ""}`;
}

export function sortConflicts(list: Conflict[]): Conflict[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
}

/** Short summary for lists: "None", "Not answered", or "3 dates". */
export function conflictSummary(a: Pick<Auditioner, "conflicts" | "conflict_notes" | "no_conflicts">): string {
  const n = a.conflicts?.length ?? 0;
  if (n) return n === 1 ? "1 date" : `${n} dates`;
  if (a.conflict_notes) return "See note";
  return a.no_conflicts ? "None" : "Not answered";
}
