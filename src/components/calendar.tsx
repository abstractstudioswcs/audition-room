"use client";

import { formatDay } from "@/lib/conflicts";
import {
  addMonths,
  byDate,
  eventName,
  eventTime,
  KIND_LABEL,
  KINDS,
  monthGrid,
  monthLabel,
  shortTime,
  todayIso,
  WEEKDAYS,
} from "@/lib/calendar";
import type { RehearsalEvent } from "@/lib/types";

/**
 * Month calendar of rehearsal dates. The team uses it to build and review the
 * schedule; performers use it to tap the days they can't make.
 */
export function Calendar({
  events,
  month,
  onMonth,
  onDay,
  selected,
  marked,
  outCount,
  markedLabel = "Can’t make it",
}: {
  events: RehearsalEvent[];
  month: string;
  onMonth: (m: string) => void;
  onDay: (date: string) => void;
  /** The day open in a side panel (team view). */
  selected?: string | null;
  /** Days the viewer can't make (performer view). */
  marked?: Set<string>;
  /** People out per day (team view). */
  outCount?: Record<string, number>;
  markedLabel?: string;
}) {
  const days = byDate(events);
  const today = todayIso();
  const weeks = monthGrid(month);
  const kindsUsed = KINDS.filter((k) => events.some((e) => e.kind === k));

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="btn small" onClick={() => onMonth(addMonths(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <h3 className="cal-title" aria-live="polite">{monthLabel(month)}</h3>
        <button type="button" className="btn small" onClick={() => onMonth(addMonths(month, 1))} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal-grid" role="group" aria-label={monthLabel(month)}>
        <div className="cal-row" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-dow">{w}</span>
          ))}
        </div>
        {weeks.map((week) => (
          <div className="cal-row" key={week[0].date}>
            {week.map(({ date, inMonth }) => {
              const list = days.get(date) ?? [];
              const isMarked = marked?.has(date) ?? false;
              const out = outCount?.[date] ?? 0;
              const label = [
                formatDay(date),
                list.length ? list.map((e) => `${eventName(e)}, ${eventTime(e)}`).join("; ") : "nothing scheduled",
                isMarked ? markedLabel : "",
                out ? `${out} ${out === 1 ? "person" : "people"} out` : "",
              ].filter(Boolean).join(". ");
              const cls = [
                "cal-day",
                inMonth ? "" : "other-month",
                date === today ? "today" : "",
                selected === date ? "sel" : "",
                isMarked ? "marked" : "",
                list.length ? "has-events" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={date}
                  type="button"
                  className={cls}
                  aria-pressed={selected !== undefined ? selected === date : marked ? isMarked : undefined}
                  aria-label={label}
                  onClick={() => onDay(date)}
                >
                  <span className="cal-num">{Number(date.slice(8))}</span>
                  <span className="cal-events" aria-hidden="true">
                    {list.slice(0, 2).map((e) => (
                      <span key={e.id} className={`cal-ev k-${e.kind}`}>
                        <span className="cal-ev-text">{shortTime(e) ? `${shortTime(e)} ` : ""}{e.title || KIND_LABEL[e.kind]}</span>
                      </span>
                    ))}
                    {list.length > 2 && <span className="cal-more">+{list.length - 2} more</span>}
                  </span>
                  {isMarked && <span className="cal-flag" aria-hidden="true">Out</span>}
                  {out > 0 && <span className="cal-out" aria-hidden="true">{out} out</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {(kindsUsed.length > 0 || marked || outCount) && (
        <div className="cal-legend" aria-hidden="true">
          {kindsUsed.map((k) => (
            <span key={k}><span className={`cal-swatch k-${k}`} /> {KIND_LABEL[k]}</span>
          ))}
          {marked && <span><span className="cal-swatch marked" /> {markedLabel}</span>}
          {outCount && <span><span className="cal-swatch out" /> People out</span>}
        </div>
      )}
    </div>
  );
}
