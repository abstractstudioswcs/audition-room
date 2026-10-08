"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProductionFrame, productionTabs } from "@/components/production-frame";
import { fitNotes, fitRank, roleSpec } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Auditioner, Casting, Character } from "@/lib/types";
import { useProduction, type ProductionData } from "@/lib/use-production";

export function CastingBoard() {
  const productionId = useParams<{ id: string }>().id;
  const { data, state, live, refresh } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={state} live={live} tabs={productionTabs(productionId)}>
      {(d) => <Board d={d} refresh={refresh} />}
    </ProductionFrame>
  );
}

function Board({ d, refresh }: { d: ProductionData; refresh: () => void }) {
  const [error, setError] = useState("");

  if (d.characters.length === 0) {
    return (
      <div className="empty">
        <h2>Add your characters first</h2>
        <p className="lede">The casting board makes one column per character, with the range you need.</p>
        <Link className="btn primary big" href={`/app/p/${d.production.id}`}>Set up characters</Link>
      </div>
    );
  }

  const fitFor = (a: Auditioner, c: Character) => {
    const sc = d.scores[a.id];
    return fitNotes({ low: sc?.low_note, high: sc?.high_note }, { low: c.low_note, high: c.high_note });
  };
  const sessionName = (a: Auditioner) =>
    d.sessions.length > 1 ? d.sessions.find((s) => s.id === a.session_id)?.name ?? "" : "";
  const placed = new Set(d.castings.map((c) => c.auditioner_id));
  const unplaced = d.auditioners.filter((a) => !placed.has(a.id));

  async function write(op: PromiseLike<{ error: unknown }>) {
    const { error: err } = await op;
    setError(err ? "That change didn’t save. Check your connection and try again." : "");
    refresh();
  }
  const sb = supabaseBrowser();

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 30 }}>Casting board</h1>
        <p className="lede" style={{ marginTop: 6 }}>
          Place singers on characters, mark who you’re casting, and keep notes. One person can sit on several characters. Fit labels
          come from ranges logged in the Music director view.
        </p>
      </div>
      {error && <p className="banner" style={{ margin: 0 }} role="alert">{error}</p>}
      <div className="castgrid">
        {d.characters.map((c) => {
          const cands = d.castings
            .filter((x) => x.character_id === c.id)
            .map((x) => ({ x, a: d.auditioners.find((a) => a.id === x.auditioner_id) }))
            .filter((y): y is { x: Casting; a: Auditioner } => !!y.a)
            .sort((p, q) => (p.x.status === "cast" ? 0 : 1) - (q.x.status === "cast" ? 0 : 1) || p.a.slot - q.a.slot);
          const avail = d.auditioners
            .filter((a) => !d.castings.some((x) => x.character_id === c.id && x.auditioner_id === a.id))
            .map((a) => ({ a, f: fitFor(a, c) }))
            .sort((p, q) => fitRank(p.f) - fitRank(q.f) || p.a.slot - q.a.slot);
          return (
            <section className="panel" key={c.id}>
              <div>
                <h2 style={{ fontSize: 24 }}>{c.name}</h2>
                <p className="hint" style={{ marginTop: 4 }}>{roleSpec(c) || "No range set"}</p>
                {c.notes && <p style={{ marginTop: 6 }}>{c.notes}</p>}
              </div>
              {cands.length === 0 && <p className="hint">No one placed yet.</p>}
              {cands.map(({ x, a }) => {
                const f = fitFor(a, c), sc = d.scores[a.id];
                const meta = [
                  sc?.voice,
                  sc?.low_note && sc?.high_note ? `${sc.low_note} to ${sc.high_note}` : "",
                  sc?.rating ? `vocal ${sc.rating} of 5` : "",
                  sessionName(a),
                ].filter(Boolean).join(", ");
                const key = { character_id: c.id, auditioner_id: a.id };
                return (
                  <div className={`cand${x.status === "cast" ? " is-cast" : ""}`} key={a.id}>
                    <div className="cand-top">
                      <span className="cand-name">{a.slot} · {a.name}</span>
                      <span className={`fitlabel fit-${f.kind}`}>{f.text}</span>
                    </div>
                    <p className="hint">{meta || "No vocal notes yet"}</p>
                    <div className="seg2" role="group" aria-label={`Status for ${a.name}`}>
                      {(["considering", "cast"] as const).map((s) => (
                        <button key={s} aria-pressed={x.status === s}
                          onClick={() => x.status !== s && write(sb.from("castings").update({ status: s }).match(key))}>
                          {s === "cast" ? "Cast" : "Considering"}
                        </button>
                      ))}
                    </div>
                    <CastNote casting={x} label={`Notes on ${a.name} as ${c.name}`}
                      onSave={(note) => write(sb.from("castings").update({ note }).match(key))} />
                    <button className="linkbtn" onClick={() => write(sb.from("castings").delete().match(key))}>
                      Take off {c.name}
                    </button>
                  </div>
                );
              })}
              {avail.length > 0 ? (
                <div className="field">
                  <label htmlFor={`add-${c.id}`}>Add a singer</label>
                  <select
                    id={`add-${c.id}`}
                    value=""
                    onChange={(e) => e.target.value && write(sb.from("castings").insert({ character_id: c.id, auditioner_id: e.target.value }))}
                  >
                    <option value="">Choose someone</option>
                    {avail.map(({ a, f }) => (
                      <option key={a.id} value={a.id}>
                        {a.slot} · {a.name}, {f.text}{sessionName(a) ? ` (${sessionName(a)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                d.auditioners.length === 0 && <p className="hint">Singers appear here after they check in.</p>
              )}
            </section>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <section className="panel">
          <h2 style={{ fontSize: 20 }}>Not placed yet</h2>
          <p>{unplaced.map((a) => `${a.slot} · ${a.name}`).join(", ")}</p>
        </section>
      )}
    </div>
  );
}

/** Saves when you leave the box. Picks up other people's edits unless you're typing. */
function CastNote({ casting, label, onSave }: { casting: Casting; label: string; onSave: (note: string) => void }) {
  const [text, setText] = useState(casting.note);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(casting.note);
  }, [casting.note]);
  const id = `cn-${casting.character_id}-${casting.auditioner_id}`;
  return (
    <>
      <label className="label" htmlFor={id}>Notes</label>
      <textarea
        id={id}
        aria-label={label}
        rows={2}
        placeholder="Acting, chemistry, what to check at callbacks"
        value={text}
        onFocus={() => (editing.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          editing.current = false;
          if (text !== casting.note) onSave(text);
        }}
      />
    </>
  );
}
