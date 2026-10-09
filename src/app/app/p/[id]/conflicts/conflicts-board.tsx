"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ConflictList } from "@/components/conflict-list";
import { Headshot } from "@/components/headshot";
import { ProductionFrame, productionTabs } from "@/components/production-frame";
import { conflictSummary, formatDay, formatSpan, sortConflicts } from "@/lib/conflicts";
import type { Auditioner, Conflict } from "@/lib/types";
import { useProduction, type ProductionData } from "@/lib/use-production";

export function ConflictsBoard() {
  const productionId = useParams<{ id: string }>().id;
  const { data, state, live } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={state} live={live} tabs={productionTabs()}>
      {(d) => <Board d={d} />}
    </ProductionFrame>
  );
}

type Who = "everyone" | "board" | "cast";

function Board({ d }: { d: ProductionData }) {
  const [who, setWho] = useState<Who>(() => (d.castings.some((x) => x.status === "cast") ? "cast" : "everyone"));
  const [view, setView] = useState<"date" | "person">("date");

  const roleFor = (a: Auditioner) =>
    d.castings
      .filter((x) => x.auditioner_id === a.id && (who !== "cast" || x.status === "cast"))
      .map((x) => d.characters.find((c) => c.id === x.character_id)?.name)
      .filter(Boolean)
      .join(", ");
  const people = d.auditioners.filter((a) => {
    if (who === "everyone") return true;
    return d.castings.some((x) => x.auditioner_id === a.id && (who === "board" || x.status === "cast"));
  });

  // Every conflict, grouped by day.
  const byDate = new Map<string, { a: Auditioner; c: Conflict }[]>();
  for (const a of people) {
    for (const c of sortConflicts(a.conflicts ?? [])) {
      byDate.set(c.date, [...(byDate.get(c.date) ?? []), { a, c }]);
    }
  }
  const dates = [...byDate.keys()].sort();
  const unanswered = people.filter((a) => !a.conflicts?.length && !a.conflict_notes && !a.no_conflicts);
  const notesOnly = people.filter((a) => a.conflict_notes);

  function downloadCsv() {
    const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Date", "Day", "Time", "Name", "Audition #", "Characters", "Reason"].map(q).join(",")];
    for (const date of dates) {
      for (const { a, c } of byDate.get(date)!) {
        rows.push([date, formatDay(date), formatSpan(c), a.name, String(a.slot), roleFor(a), c.note].map(q).join(","));
      }
    }
    for (const a of notesOnly) rows.push(["", "", "", a.name, String(a.slot), roleFor(a), `Note: ${a.conflict_notes}`].map(q).join(","));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${d.production.title.replace(/[^\w\- ]+/g, "").trim() || "production"} conflicts.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 style={{ fontSize: 30 }}>Rehearsal conflicts</h1>
          <p className="lede" style={{ marginTop: 6 }}>Hard conflicts performers listed at check-in, for building the rehearsal schedule.</p>
        </div>
        <button className="btn" onClick={downloadCsv} disabled={dates.length === 0 && notesOnly.length === 0}>
          Download as spreadsheet (CSV)
        </button>
      </div>

      <section className="panel">
        <div className="spread">
          <h2 style={{ fontSize: 20 }}>Rehearsal schedule</h2>
          <Link href={`/app/p/${d.production.id}`}>Edit in Setup</Link>
        </div>
        <p style={{ whiteSpace: "pre-wrap" }} className={d.production.rehearsal_info ? undefined : "hint"}>
          {d.production.rehearsal_info || "Not posted yet. Add it in Setup so performers see it before listing conflicts."}
        </p>
      </section>

      <div className="inline">
        <div className="seg2" role="group" aria-label="Who to show" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", minWidth: 330 }}>
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
        <div className="seg2" role="group" aria-label="Group by" style={{ minWidth: 220 }}>
          <button aria-pressed={view === "date"} onClick={() => setView("date")}>By date</button>
          <button aria-pressed={view === "person"} onClick={() => setView("person")}>By person</button>
        </div>
        <span className="hint">
          {people.length} {people.length === 1 ? "person" : "people"} · {dates.length} {dates.length === 1 ? "date" : "dates"} with conflicts
        </span>
      </div>

      {people.length === 0 ? (
        <div className="empty">
          <h2>{who === "everyone" ? "Nobody has checked in yet" : who === "cast" ? "No one is marked Cast yet" : "No one is on the casting board yet"}</h2>
          <p className="lede">Switch to Everyone to see all performers.</p>
        </div>
      ) : view === "date" ? (
        <div className="stack" style={{ gap: 10 }}>
          {dates.length === 0 && <p className="lede">No one in this group listed a specific date.</p>}
          {dates.map((date) => {
            const items = byDate.get(date)!;
            return (
              <section className="panel" key={date} style={{ gap: 10 }}>
                <div className="spread">
                  <h3 style={{ fontSize: 20 }}>{formatDay(date)}</h3>
                  <span className="hint">{items.length === 1 ? "1 person out" : `${items.length} people out`}</span>
                </div>
                {items.map(({ a, c }, i) => (
                  <div key={`${a.id}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Headshot path={a.headshot_path} name={a.name} size={36} />
                    <span style={{ minWidth: 0 }}>
                      <strong>{a.name}</strong>
                      {roleFor(a) ? <span className="hint"> · {roleFor(a)}</span> : null}
                      <br />
                      <span>{formatSpan(c)}</span>
                      {c.note ? <span className="hint"> · {c.note}</span> : null}
                    </span>
                  </div>
                ))}
              </section>
            );
          })}
          {notesOnly.length > 0 && (
            <section className="panel">
              <h3 style={{ fontSize: 20 }}>Other schedule notes</h3>
              {notesOnly.map((a) => (
                <p key={a.id}>
                  <strong>{a.name}:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{a.conflict_notes}</span>
                </p>
              ))}
            </section>
          )}
          {unanswered.length > 0 && (
            <p className="hint">Didn’t answer: {unanswered.map((a) => a.name).join(", ")}.</p>
          )}
        </div>
      ) : (
        <div className="castgrid">
          {people.map((a) => (
            <section className="panel" key={a.id} style={{ gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Headshot path={a.headshot_path} name={a.name} size={44} />
                <div>
                  <strong>{a.slot} · {a.name}</strong>
                  <br />
                  <span className="hint">{[roleFor(a), conflictSummary(a)].filter(Boolean).join(" · ")}</span>
                </div>
              </div>
              <ConflictList a={a} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
