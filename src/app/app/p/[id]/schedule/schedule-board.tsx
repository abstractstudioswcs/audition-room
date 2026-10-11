"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Calendar } from "@/components/calendar";
import { ConflictList } from "@/components/conflict-list";
import { Headshot } from "@/components/headshot";
import { ProductionFrame, productionTabs } from "@/components/production-frame";
import { eventName, eventTime, initialMonth, KIND_LABEL, KINDS, MAX_REPEAT, repeatDates, WEEKDAYS } from "@/lib/calendar";
import { conflictSummary, formatDay, formatSpan, sortConflicts } from "@/lib/conflicts";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Auditioner, Conflict, EventKind, RehearsalEvent } from "@/lib/types";
import { useProduction, type ProductionData } from "@/lib/use-production";

export function ScheduleBoard() {
  const productionId = useParams<{ id: string }>().id;
  const { data, state, live, refresh } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={state} live={live} tabs={productionTabs()}>
      {(d) => <Board d={d} refresh={refresh} />}
    </ProductionFrame>
  );
}

type Who = "everyone" | "board" | "cast";

function Board({ d, refresh }: { d: ProductionData; refresh: () => void }) {
  const [who, setWho] = useState<Who>(() => (d.castings.some((x) => x.status === "cast") ? "cast" : "everyone"));
  const [month, setMonth] = useState(() => initialMonth(d.events));
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<"date" | "person">("date");

  const roleFor = (a: Auditioner) =>
    d.castings
      .filter((x) => x.auditioner_id === a.id && (who !== "cast" || x.status === "cast"))
      .map((x) => d.characters.find((c) => c.id === x.character_id)?.name)
      .filter(Boolean)
      .join(", ");
  const people = d.auditioners.filter((a) =>
    who === "everyone" ? true : d.castings.some((x) => x.auditioner_id === a.id && (who === "board" || x.status === "cast")),
  );

  // Who is out on each date, for the chosen group.
  const outByDate = new Map<string, { a: Auditioner; c: Conflict }[]>();
  for (const a of people) {
    for (const c of sortConflicts(a.conflicts ?? [])) outByDate.set(c.date, [...(outByDate.get(c.date) ?? []), { a, c }]);
  }
  const outCount: Record<string, number> = {};
  outByDate.forEach((v, k) => (outCount[k] = new Set(v.map((x) => x.a.id)).size));
  const conflictDates = [...outByDate.keys()].sort();
  const notesOnly = people.filter((a) => a.conflict_notes);
  const unanswered = people.filter((a) => !a.conflicts?.length && !a.conflict_notes && !a.no_conflicts);

  function downloadCsv() {
    const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Day", "Scheduled", "Out", "Name", "Audition #", "Characters", "Reason"].map(q).join(",")];
    const scheduled = (date: string) => d.events.filter((e) => e.date === date).map((e) => `${eventName(e)} ${eventTime(e)}`).join("; ");
    for (const date of conflictDates) {
      for (const { a, c } of outByDate.get(date)!) {
        rows.push([date, formatDay(date), scheduled(date), formatSpan(c), a.name, String(a.slot), roleFor(a), c.note].map(q).join(","));
      }
    }
    for (const a of notesOnly) rows.push(["", "", "", "", a.name, String(a.slot), roleFor(a), `Note: ${a.conflict_notes}`].map(q).join(","));
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${d.production.title.replace(/[^\w\- ]+/g, "").trim() || "production"} conflicts.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 30 }}>Schedule</h1>
        <p className="lede" style={{ marginTop: 6 }}>
          Build the rehearsal calendar here. Performers see it when they check in and tap the days they can’t make.
        </p>
      </div>

      <div className="inline">
        <span className="label">Show conflicts for</span>
        <div className="seg2" role="group" aria-label="Whose conflicts to show" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", minWidth: 330 }}>
          {(
            [
              ["everyone", "Everyone"],
              ["board", "On the board"],
              ["cast", "Cast"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} aria-pressed={who === k} onClick={() => setWho(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="schedule-layout">
        <section className="panel">
          <Calendar
            events={d.events}
            month={month}
            onMonth={setMonth}
            onDay={(date) => setDay(date === day ? null : date)}
            selected={day}
            outCount={outCount}
          />
          {d.events.length === 0 && (
            <p className="hint">
              No dates yet. Tap a day to add one, or use “Add a repeating schedule” to fill in your usual rehearsal nights.
            </p>
          )}
        </section>
        <div className="stack" style={{ gap: 16 }}>
          {day ? (
            <DayPanel
              date={day}
              events={d.events.filter((e) => e.date === day)}
              out={outByDate.get(day) ?? []}
              roleFor={roleFor}
              productionId={d.production.id}
              refresh={refresh}
              onClose={() => setDay(null)}
            />
          ) : (
            <section className="panel">
              <h2 style={{ fontSize: 20 }}>Pick a day</h2>
              <p className="hint">Tap any day on the calendar to add or edit what’s scheduled and see who’s out.</p>
            </section>
          )}
          <RepeatPanel productionId={d.production.id} refresh={refresh} onAdded={(first) => setMonth(first.slice(0, 7))} />
          <NotesPanel d={d} refresh={refresh} />
        </div>
      </div>

      <section className="panel">
        <div className="spread">
          <h2 style={{ fontSize: 22 }}>Conflicts</h2>
          <div className="inline">
            <div className="seg2" role="group" aria-label="Group conflicts by" style={{ minWidth: 220 }}>
              <button aria-pressed={view === "date"} onClick={() => setView("date")}>By date</button>
              <button aria-pressed={view === "person"} onClick={() => setView("person")}>By person</button>
            </div>
            <button className="btn" onClick={downloadCsv} disabled={conflictDates.length === 0 && notesOnly.length === 0}>
              Download spreadsheet (CSV)
            </button>
          </div>
        </div>
        <p className="hint">
          {people.length} {people.length === 1 ? "person" : "people"} · {conflictDates.length} {conflictDates.length === 1 ? "date" : "dates"} with conflicts
          {unanswered.length ? ` · didn’t answer: ${unanswered.map((a) => a.name).join(", ")}` : ""}
        </p>
        {people.length === 0 ? (
          <p className="lede">
            {who === "everyone" ? "Nobody has checked in yet." : who === "cast" ? "No one is marked Cast yet." : "No one is on the casting board yet."}
          </p>
        ) : view === "date" ? (
          <div className="stack" style={{ gap: 12 }}>
            {conflictDates.length === 0 && <p className="lede">No one in this group listed a specific date.</p>}
            {conflictDates.map((date) => (
              <div key={date} className="ev-item">
                <div className="spread">
                  <button className="linkbtn" style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16, textDecoration: "none" }}
                    onClick={() => { setDay(date); setMonth(date.slice(0, 7)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    {formatDay(date)}
                  </button>
                  <span className="hint">
                    {d.events.filter((e) => e.date === date).map((e) => `${eventName(e)}, ${eventTime(e)}`).join(" · ") || "Nothing scheduled"}
                  </span>
                </div>
                {outByDate.get(date)!.map(({ a, c }, i) => (
                  <PersonOut key={`${a.id}-${i}`} a={a} c={c} role={roleFor(a)} />
                ))}
              </div>
            ))}
            {notesOnly.length > 0 && (
              <div className="ev-item">
                <strong>Other schedule notes</strong>
                {notesOnly.map((a) => (
                  <p key={a.id}><strong>{a.name}:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{a.conflict_notes}</span></p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="castgrid">
            {people.map((a) => (
              <div className="ev-item" key={a.id}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Headshot path={a.headshot_path} name={a.name} size={44} />
                  <div>
                    <strong>{a.slot} · {a.name}</strong>
                    <br />
                    <span className="hint">{[roleFor(a), conflictSummary(a)].filter(Boolean).join(" · ")}</span>
                  </div>
                </div>
                <ConflictList a={a} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PersonOut({ a, c, role }: { a: Auditioner; c: Conflict; role: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Headshot path={a.headshot_path} name={a.name} size={36} />
      <span style={{ minWidth: 0 }}>
        <strong>{a.name}</strong>
        {role ? <span className="hint"> · {role}</span> : null}
        <br />
        <span>{formatSpan(c)}</span>
        {c.note ? <span className="hint"> · {c.note}</span> : null}
      </span>
    </div>
  );
}

/* ---------- one day: what's scheduled and who's out ---------- */

type Draft = { kind: EventKind; title: string; start_time: string; end_time: string; notes: string };
const emptyDraft: Draft = { kind: "rehearsal", title: "", start_time: "", end_time: "", notes: "" };

function DayPanel({
  date,
  events,
  out,
  roleFor,
  productionId,
  refresh,
  onClose,
}: {
  date: string;
  events: RehearsalEvent[];
  out: { a: Auditioner; c: Conflict }[];
  roleFor: (a: Auditioner) => string;
  productionId: string;
  refresh: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null); // event id, or "new"
  const [msg, setMsg] = useState("");
  const sb = supabaseBrowser();

  async function save(draft: Draft, id: string | null) {
    setMsg("Saving…");
    const row = { ...draft, title: draft.title.trim(), notes: draft.notes.trim() };
    const { error } = id
      ? await sb.from("rehearsal_events").update(row).eq("id", id)
      : await sb.from("rehearsal_events").insert({ ...row, production_id: productionId, date });
    if (error) return setMsg("Didn’t save. Check the times and try again.");
    setMsg("Saved");
    setEditing(null);
    refresh();
  }

  async function remove(id: string) {
    const { error } = await sb.from("rehearsal_events").delete().eq("id", id);
    setMsg(error ? "Didn’t delete. Try again." : "Deleted");
    setEditing(null);
    refresh();
  }

  return (
    <section className="panel" aria-label={formatDay(date)}>
      <div className="spread">
        <h2 style={{ fontSize: 22 }}>{formatDay(date)}</h2>
        <button className="linkbtn" onClick={onClose}>Close</button>
      </div>

      {events.length === 0 && editing !== "new" && <p className="hint">Nothing scheduled.</p>}
      {events.map((e) =>
        editing === e.id ? (
          <EventForm key={e.id} initial={e} onSave={(dr) => save(dr, e.id)} onCancel={() => setEditing(null)} onDelete={() => remove(e.id)} />
        ) : (
          <div key={e.id} className="ev-item">
            <span>
              <span className={`cal-ev k-${e.kind}`} style={{ display: "inline-block", marginRight: 6 }}>{KIND_LABEL[e.kind]}</span>
              <strong>{e.title}</strong>
            </span>
            <span>{eventTime(e)}</span>
            {e.notes && <span className="hint" style={{ whiteSpace: "pre-wrap" }}>{e.notes}</span>}
            <button className="linkbtn" style={{ minHeight: 32 }} onClick={() => setEditing(e.id)}>Edit</button>
          </div>
        ),
      )}
      {editing === "new" ? (
        <EventForm initial={emptyDraft} onSave={(dr) => save(dr, null)} onCancel={() => setEditing(null)} />
      ) : (
        <button className="btn primary self-start" onClick={() => setEditing("new")}>Add to this day</button>
      )}
      <span className="saved" role="status">{msg}</span>

      <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <strong>{out.length ? `Out this day (${new Set(out.map((x) => x.a.id)).size})` : "No one has a conflict this day"}</strong>
        {out.map(({ a, c }, i) => (
          <PersonOut key={`${a.id}-${i}`} a={a} c={c} role={roleFor(a)} />
        ))}
      </div>
    </section>
  );
}

function EventForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Draft;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [dr, setDr] = useState<Draft>({
    kind: initial.kind, title: initial.title, start_time: initial.start_time, end_time: initial.end_time, notes: initial.notes,
  });
  const [armed, setArmed] = useState(false);
  const set = (p: Partial<Draft>) => setDr((x) => ({ ...x, ...p }));
  return (
    <form
      className="ev-item"
      style={{ gap: 10 }}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(dr);
      }}
    >
      <div className="row2">
        <div className="field">
          <label htmlFor="ev-kind">Type</label>
          <select id="ev-kind" value={dr.kind} onChange={(e) => set({ kind: e.target.value as EventKind })}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-title">Title (optional)</label>
          <input id="ev-title" value={dr.title} maxLength={80} placeholder="Act 1 blocking" onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label htmlFor="ev-start">Starts</label>
          <input id="ev-start" type="time" value={dr.start_time} onChange={(e) => set({ start_time: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ev-end">Ends</label>
          <input id="ev-end" type="time" value={dr.end_time} onChange={(e) => set({ end_time: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ev-notes">Notes (optional)</label>
        <input id="ev-notes" value={dr.notes} maxLength={500} placeholder="Leads only, bring scripts" onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <div className="inline">
        <button className="btn primary" type="submit">Save</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button className="btn danger" type="button" onClick={() => (armed ? onDelete() : setArmed(true))}>
            {armed ? "Tap again to delete" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------- repeating schedule ---------- */

function RepeatPanel({ productionId, refresh, onAdded }: { productionId: string; refresh: () => void; onAdded: (first: string) => void }) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dr, setDr] = useState<Draft>({ ...emptyDraft, start_time: "18:00", end_time: "21:00" });
  const [msg, setMsg] = useState("");
  const dates = repeatDates(from, to, days);

  async function add() {
    if (!dates.length) return setMsg("Pick the days of the week and a start and end date.");
    setMsg("Adding…");
    const rows = dates.map((date) => ({
      production_id: productionId, date, kind: dr.kind, title: dr.title.trim(), start_time: dr.start_time, end_time: dr.end_time, notes: "",
    }));
    const { error } = await supabaseBrowser().from("rehearsal_events").insert(rows);
    if (error) return setMsg("Didn’t save. Check the times and try again.");
    setMsg(`Added ${dates.length} ${dates.length === 1 ? "date" : "dates"}.`);
    onAdded(dates[0]);
    refresh();
  }

  return (
    <details className="panel">
      <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 20 }}>
        Add a repeating schedule
      </summary>
      <div className="stack" style={{ gap: 12, marginTop: 12 }}>
        <p className="hint">Fill in your regular rehearsal nights all at once. You can change or delete any single day afterward.</p>
        <fieldset>
          <legend>Every</legend>
          <div className="weekday-pick">
            {WEEKDAYS.map((w, i) => (
              <label key={w}>
                <input type="checkbox" checked={days.includes(i)}
                  onChange={(e) => setDays(e.target.checked ? [...days, i] : days.filter((x) => x !== i))} />
                {w}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row2">
          <div className="field">
            <label htmlFor="rp-from">From</label>
            <input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rp-to">Until</label>
            <input id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="rp-start">Starts</label>
            <input id="rp-start" type="time" value={dr.start_time} onChange={(e) => setDr({ ...dr, start_time: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="rp-end">Ends</label>
            <input id="rp-end" type="time" value={dr.end_time} onChange={(e) => setDr({ ...dr, end_time: e.target.value })} />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="rp-kind">Type</label>
            <select id="rp-kind" value={dr.kind} onChange={(e) => setDr({ ...dr, kind: e.target.value as EventKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rp-title">Title (optional)</label>
            <input id="rp-title" value={dr.title} maxLength={80} placeholder="Rehearsal" onChange={(e) => setDr({ ...dr, title: e.target.value })} />
          </div>
        </div>
        <div className="inline">
          <button className="btn primary" onClick={add} disabled={!dates.length}>
            {dates.length ? `Add ${dates.length} ${dates.length === 1 ? "date" : "dates"}` : "Add dates"}
          </button>
          <span className="saved" role="status">
            {msg || (dates.length >= MAX_REPEAT ? `That’s the most at once (${MAX_REPEAT}). Add the rest in a second batch.` : "")}
          </span>
        </div>
      </div>
    </details>
  );
}

/* ---------- free-text notes for performers ---------- */

function NotesPanel({ d, refresh }: { d: ProductionData; refresh: () => void }) {
  const [text, setText] = useState(d.production.rehearsal_info ?? "");
  const [msg, setMsg] = useState("");
  const dirty = text.trim() !== (d.production.rehearsal_info ?? "");
  return (
    <details className="panel" open={!!d.production.rehearsal_info}>
      <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 20 }}>
        Notes for performers
      </summary>
      <div className="stack" style={{ gap: 10, marginTop: 12 }}>
        <p className="hint">Shown above the calendar at check-in. Good for things a calendar can’t say, like “Leads called most nights; ensemble Tue and Thu.”</p>
        <div className="field">
          <label htmlFor="rinfo">Notes</label>
          <textarea id="rinfo" rows={4} maxLength={2000} value={text} onChange={(e) => { setText(e.target.value); setMsg(""); }} />
        </div>
        <div className="inline">
          <button
            className="btn primary"
            disabled={!dirty}
            onClick={async () => {
              setMsg("Saving…");
              const { error } = await supabaseBrowser().from("productions").update({ rehearsal_info: text.trim() }).eq("id", d.production.id);
              setMsg(error ? "Not saved. Try again." : "Saved");
              refresh();
            }}
          >
            Save notes
          </button>
          <span className="saved" role="status">{dirty && !msg ? "Unsaved changes" : msg}</span>
        </div>
      </div>
    </details>
  );
}
