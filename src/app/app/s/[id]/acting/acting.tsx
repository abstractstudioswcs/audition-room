"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { ScoringDesk, SingerHeader, toggleCasting } from "@/components/scoring-desk";
import { fitNotes } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Auditioner, Session } from "@/lib/types";
import { useProduction, useSessionProduction, type ProductionData } from "@/lib/use-production";

export function Acting() {
  const sessionId = useParams<{ id: string }>().id;
  const { productionId, missing } = useSessionProduction(sessionId);
  const { data, state, live, refresh } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={missing ? "missing" : state} live={live} tabs={sessionTabs(sessionId)}>
      {(d) => {
        const session = d.sessions.find((s) => s.id === sessionId);
        if (!session) return <p className="lede">This session was deleted.</p>;
        return <Desk d={d} session={session} refresh={refresh} />;
      }}
    </ProductionFrame>
  );
}

function Desk({ d, session, refresh }: { d: ProductionData; session: Session; refresh: () => void }) {
  const currentId = session.current_auditioner_id;
  return (
    <ScoringDesk
      d={d}
      session={session}
      refresh={refresh}
      emptyText="When singers check in, pick one from the list to rate their acting and place them on characters."
      status={(a) => {
        const sc = d.scores[a.id];
        if (a.id === currentId && a.status !== "done") return <small className="cb">On stage</small>;
        if (sc?.acting_rating) return <small>Acting {sc.acting_rating}</small>;
        if (a.status === "done") return <small>Not rated</small>;
        return <small>Waiting</small>;
      }}
    >
      {(a, onDirty) => <Detail a={a} d={d} onDirty={onDirty} refresh={refresh} />}
    </ScoringDesk>
  );
}

function Detail({ a, d, onDirty, refresh }: { a: Auditioner; d: ProductionData; onDirty: (v: boolean) => void; refresh: () => void }) {
  const saved = d.scores[a.id];
  const [rating, setRating] = useState<number | null>(saved?.acting_rating ?? null);
  const [notes, setNotes] = useState(saved?.acting_notes ?? "");
  const [msg, setMsg] = useState(saved?.acting_rating || saved?.acting_notes ? "Saved" : "");
  const [placing, setPlacing] = useState<string | null>(null);

  const changed = () => {
    setMsg("Unsaved changes");
    onDirty(true);
  };

  async function save() {
    setMsg("Saving…");
    // Only the acting columns are sent, so the music director's vocal notes stay as they are.
    const { error } = await supabaseBrowser()
      .from("scores")
      .upsert({ auditioner_id: a.id, acting_rating: rating, acting_notes: notes, updated_at: new Date().toISOString() });
    if (error) return setMsg("Not saved. Try again.");
    setMsg("Saved");
    onDirty(false);
    refresh();
  }

  const vocal = [
    saved?.voice,
    saved?.low_note && saved?.high_note ? `${saved.low_note} to ${saved.high_note}` : "",
    saved?.belt_note ? `belts to ${saved.belt_note}` : "",
    saved?.rating ? `vocal ${saved.rating} of 5` : "",
  ].filter(Boolean).join(", ");

  return (
    <div className="stack">
      <SingerHeader a={a} d={d} />
      <div className="mdgrid">
        <div className="stack" style={{ minWidth: 0 }}>
          <section className="panel">
            <h3 style={{ fontSize: 20 }}>From the music director</h3>
            <p>{vocal || "No vocal notes yet."}</p>
            {saved?.notes && <p className="hint" style={{ whiteSpace: "pre-wrap" }}>{saved.notes}</p>}
          </section>
          <section className="panel">
            <div className="spread">
              <h3 style={{ fontSize: 20 }}>Place on characters</h3>
              <span className="hint">Adds them to that character’s column on the casting board.</span>
            </div>
            {d.characters.length === 0 ? (
              <p className="hint">Add the characters you’re casting in Setup first.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {d.characters.map((c) => {
                  const on = d.castings.some((x) => x.character_id === c.id && x.auditioner_id === a.id);
                  const f = fitNotes({ low: saved?.low_note, high: saved?.high_note }, { low: c.low_note, high: c.high_note });
                  return (
                    <div key={c.id} className="spread" style={{ alignItems: "center" }}>
                      <span>
                        <strong>{c.name}</strong>{" "}
                        <span className={`fitlabel fit-${f.kind}`} style={{ marginLeft: 6 }}>{f.text}</span>
                        {a.character_ids.includes(c.id) && <span className="hint"> · asked for this</span>}
                      </span>
                      <button
                        className="btn small"
                        aria-pressed={on}
                        disabled={placing === c.id}
                        onClick={async () => {
                          setPlacing(c.id);
                          const ok = await toggleCasting(c.id, a.id, on);
                          setPlacing(null);
                          if (!ok) setMsg("That casting change didn’t save. Try again.");
                          refresh();
                        }}
                      >
                        {on ? "On the board" : "Consider"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <section className="panel">
          <h3 style={{ fontSize: 20 }}>Acting notes</h3>
          <div className="field">
            <span className="label" id="ac-rlabel">Acting rating</span>
            <div className="rating" role="group" aria-labelledby="ac-rlabel">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={rating === n}
                  onClick={() => { setRating(rating === n ? null : n); changed(); }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ac-notes">Notes</label>
            <textarea id="ac-notes" rows={8} value={notes} placeholder="Read of the sides, choices, presence, chemistry, movement"
              onChange={(e) => { setNotes(e.target.value); changed(); }} />
          </div>
          <button className="btn primary big wide" onClick={save}>Save acting notes</button>
          <span className="saved" role="status">{msg}</span>
        </section>
      </div>
    </div>
  );
}
