import { formatSpan } from "./conflicts";
import type { EventKind, RehearsalEvent } from "./types";

// Dates are calendar days ("YYYY-MM-DD"). All math is done in UTC so a day never
// shifts because of the viewer's time zone.

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const KIND_LABEL: Record<EventKind, string> = {
  rehearsal: "Rehearsal",
  tech: "Tech",
  performance: "Performance",
  other: "Other",
};
export const KINDS: EventKind[] = ["rehearsal", "tech", "performance", "other"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today as "YYYY-MM-DD" in the viewer's own time zone. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11" for a date. */
export const monthOf = (iso: string) => iso.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(toDate(`${month}-01`));
}

export type GridDay = { date: string; inMonth: boolean };

/** The weeks shown for a month, Sunday first, padded with days from the months around it. */
export function monthGrid(month: string): GridDay[][] {
  const first = toDate(`${month}-01`);
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const weeks: GridDay[][] = [];
  const cur = new Date(start);
  do {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: toIso(cur), inMonth: monthOf(toIso(cur)) === month });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (monthOf(toIso(cur)) === month);
  return weeks;
}

/** The month to open on: the first upcoming event, else the first event, else this month. */
export function initialMonth(events: Pick<RehearsalEvent, "date">[], today = todayIso()): string {
  const dates = events.map((e) => e.date).sort();
  const upcoming = dates.find((d) => d >= today);
  return monthOf(upcoming ?? dates[0] ?? today);
}

/** "6:00 pm to 9:00 pm", "All day" or "Time to be announced". */
export function eventTime(e: Pick<RehearsalEvent, "start_time" | "end_time">): string {
  if (!e.start_time && !e.end_time) return "Time to be announced";
  return formatSpan({ start: e.start_time, end: e.end_time });
}

/** "Rehearsal: Act 1 blocking" or just "Rehearsal". */
export function eventName(e: Pick<RehearsalEvent, "kind" | "title">): string {
  return e.title ? `${KIND_LABEL[e.kind]}: ${e.title}` : KIND_LABEL[e.kind];
}

/** Short time for a calendar cell: "6p", "6:30p", "6–9p". */
export function shortTime(e: Pick<RehearsalEvent, "start_time" | "end_time">): string {
  const one = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return { label: `${h % 12 || 12}${m ? `:${pad(m)}` : ""}`, pm: h >= 12 };
  };
  if (!e.start_time) return "";
  const s = one(e.start_time);
  if (!e.end_time) return `${s.label}${s.pm ? "p" : "a"}`;
  const f = one(e.end_time);
  return s.pm === f.pm ? `${s.label}–${f.label}${f.pm ? "p" : "a"}` : `${s.label}${s.pm ? "p" : "a"}–${f.label}${f.pm ? "p" : "a"}`;
}

export const MAX_REPEAT = 200;

/** Every date from `from` to `to` (inclusive) that falls on one of the weekdays (0 = Sunday). */
export function repeatDates(from: string, to: string, weekdays: number[]): string[] {
  if (!from || !to || from > to || weekdays.length === 0) return [];
  const out: string[] = [];
  const cur = toDate(from);
  const end = toDate(to);
  while (cur <= end && out.length < MAX_REPEAT) {
    if (weekdays.includes(cur.getUTCDay())) out.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Events grouped by date. */
export function byDate<T extends Pick<RehearsalEvent, "date" | "start_time">>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))) {
    map.set(e.date, [...(map.get(e.date) ?? []), e]);
  }
  return map;
}
