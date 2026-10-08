"use client";

import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { MusicFiles } from "@/components/music-view";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { ScoringDesk, SingerHeader, toggleCasting } from "@/components/scoring-desk";
import { axisPct, fit, isNoteOrEmpty, midi, roleSpec, VOICES } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MUSIC_LABEL, missingMusic, type Auditioner, type Session } from "@/lib/types";
import { useProduction, useSessionProduction, type ProductionData } from "@/lib/use-production";

export function MusicDirector() {
  const sessionId = useParams<{ id: string }>().id;
  const { productionId, missing } = useSessionProduction(sessionId);
  const { data, state, live, refresh } = useProduction(productionId);
  return (
    <ProductionFrame
      data={data}
      state={missing ? "missing" : state}
      live={live}
      tabs={sessionTabs(sessionId)}
    >
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
      emptyText="When singers check in, pick one from the list to log their range and vocal notes."
      status={(a) => <Status a={a} d={d} currentId={currentId} />}
    >
      {(a, onDirty) => <Detail a={a} d={d} onDirty={onDirty} refresh={refresh} />}
    </ScoringDesk>
  );
}

function Status({ a, d, currentId }: { a: Auditioner; d: ProductionData; currentId: string | null }) {
  const sc = d.scores[a.id];
  if (a.id === currentId && a.status !== "done") return <small className="cb">Singing</small>;
  if (sc?.callback_ids.length) return <small className="cb">Callback</small>;
  if (sc?.rating) return <small>Vocal {sc.rating}</small>;
  if (missingMusic(a) && a.status !== "done") return <small className="warn">No music</small>;
  if (a.status === "done") return <small>Sang</small>;
  return <small>Waiting</small>;
}

function Detail({
  a,
  d,
  onDirty,
  refresh,
}: {
  a: Auditioner;
  d: ProductionData;
  onDirty: (v: boolean) => void;
  refresh: () => void;
}) {
  const saved = d.scores[a.id];
  const [form, setForm] = useState({
    voice: saved?.voice ?? "",
    low_note: saved?.low_note ?? "",
    high_note: saved?.high_note ?? "",
    belt_note: saved?.belt_note ?? "",
    rating: saved?.rating ?? null,
    notes: saved?.notes ?? "",
    callback_ids: saved?.callback_ids ?? [],
  });
  const [msg, setMsg] = useState(saved ? "Saved" : "");
  const [placing, setPlacing] = useState<string | null>(null);

  const change = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setMsg("Unsaved changes");
    onDirty(true);
  };

  const badRange = !isNoteOrEmpty(form.low_note) || !isNoteOrEmpty(form.high_note) || !isNoteOrEmpty(form.belt_note);

  async function save() {
    if (badRange) return setMsg("Fix the note names first.");
    setMsg("Saving…");
    const { error } = await supabaseBrowser()
      .from("scores")
      .upsert({ auditioner_id: a.id, ...form, updated_at: new Date().toISOString() });
    if (error) return setMsg("Not saved. Try again.");
    setMsg("Saved");
    onDirty(false);
    refresh();
  }

  async function toggleConsider(characterId: string, on: boolean) {
    setPlacing(characterId);
    const ok = await toggleCasting(characterId, a.id, on);
    setPlacing(null);
    if (!ok) setMsg("That casting change didn’t save. Try again.");
    refresh();
  }

  const lo = midi(form.low_note), hi = midi(form.high_note);

  return (
    <div className="stack">
      <SingerHeader a={a} d={d} />
      <div className="mdgrid">
        <div className="stack" style={{ minWidth: 0 }}>
          <section className="panel">
            <div className="row4">
              <div className="field">
                <label htmlFor="md-voice">Voice type</label>
                <select id="md-voice" value={form.voice} onChange={(e) => change({ voice: e.target.value })}>
                  <option value="">Not set</option>
                  {VOICES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              {(
                [
                  ["low_note", "Lowest note", "G3"],
                  ["high_note", "Highest note", "E5"],
                  ["belt_note", "Belts to", "D5"],
                ] as const
              ).map(([k, label, ph]) => (
                <div className="field" key={k}>
                  <label htmlFor={`md-${k}`}>{label}</label>
                  <input id={`md-${k}`} className="mono" placeholder={ph} maxLength={4} value={form[k]}
                    aria-invalid={!isNoteOrEmpty(form[k])} onChange={(e) => change({ [k]: e.target.value })} />
                </div>
              ))}
            </div>
            {badRange && <p className="err">Write notes like G3, Bb4 or F#5.</p>}
          </section>

          <details className="panel">
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 20 }}>
              Their music · {MUSIC_LABEL[a.music_type]}
            </summary>
            <div className="stack" style={{ gap: 12, marginTop: 12 }}>
              <p className="hint">
                {[a.song_key && `Key ${a.song_key}`, a.first_note && `first note ${a.first_note}`, a.tempo && `${a.tempo} BPM`,
                  (a.cut_start || a.cut_end) && `cut ${a.cut_start || "?"} to ${a.cut_end || "?"}`].filter(Boolean).join(" · ") || "No key, tempo or cut given."}
              </p>
              {a.note && <div className="note">Singer’s note: {a.note}</div>}
              {a.files.length > 0 && <MusicFiles files={a.files} song={a.song} />}
              {a.music_type === "link" && a.track_link && (
                <a className="btn self-start" href={a.track_link} target="_blank" rel="noopener noreferrer">Open their track link</a>
              )}
              {a.music_type === "phone" && <p>Track is on the singer’s phone.</p>}
              {missingMusic(a) && <div className="missing-box">No music uploaded.</div>}
            </div>
          </details>

          <section className="panel">
            <div className="spread">
              <h3 style={{ fontSize: 20 }}>Character fit</h3>
              <span className="hint">Grey bar is the character’s range. Outline is this singer. Consider puts them on the casting board.</span>
            </div>
            {d.characters.length === 0 ? (
              <p className="hint">Add the characters you’re casting in Setup to see who fits where.</p>
            ) : (
              <div className="fitgrid">
                <span className="axis-spacer" />
                <div className="axis" aria-hidden="true">
                  {([["C3", 48], ["C4", 60], ["C5", 72], ["C6", 84]] as const).map(([l, m]) => (
                    <span key={l} style={{ left: `${axisPct(m)}%` }}>{l}</span>
                  ))}
                </div>
                <span className="axis-spacer" />
                <span className="axis-spacer" />
                {d.characters.map((c) => {
                  const rl = midi(c.low_note), rh = midi(c.high_note);
                  const f = fit(lo, hi, rl, rh);
                  const bl = rl ?? (rh !== null ? rh - 12 : null);
                  const bh = rh ?? (rl !== null ? rl + 12 : null);
                  const on = d.castings.some((x) => x.character_id === c.id && x.auditioner_id === a.id);
                  return (
                    <Fragment key={c.id}>
                      <div className="stack" style={{ gap: 0 }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span className="hint">{roleSpec(c)}</span>
                      </div>
                      <div className="track" role="img" aria-label={`${c.name}: ${f.text}`}>
                        {bl !== null && bh !== null && (
                          <div className="r" style={{ left: `${axisPct(bl)}%`, width: `${axisPct(bh) - axisPct(bl)}%` }} />
                        )}
                        {lo !== null && hi !== null && hi >= lo && (
                          <div className="s" style={{ left: `${axisPct(lo)}%`, width: `${Math.max(1, axisPct(hi) - axisPct(lo))}%` }} />
                        )}
                      </div>
                      <span className={`fitlabel fit-${f.kind}`}>{f.text}</span>
                      <button className="btn small" aria-pressed={on} disabled={placing === c.id} onClick={() => toggleConsider(c.id, on)}>
                        {on ? "On the board" : "Consider"}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="panel">
          <h3 style={{ fontSize: 20 }}>Vocal notes</h3>
          <div className="field">
            <span className="label" id="md-rlabel">Vocal rating</span>
            <div className="rating" role="group" aria-labelledby="md-rlabel">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={form.rating === n}
                  onClick={() => change({ rating: form.rating === n ? null : n })}>{n}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="md-notes">Notes</label>
            <textarea id="md-notes" rows={6} value={form.notes} onChange={(e) => change({ notes: e.target.value })} />
          </div>
          {d.characters.length > 0 ? (
            <fieldset>
              <legend>Call back for</legend>
              <div className="cbs">
                {d.characters.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={form.callback_ids.includes(c.id)}
                      onChange={(e) =>
                        change({
                          callback_ids: e.target.checked
                            ? [...form.callback_ids, c.id]
                            : form.callback_ids.filter((x) => x !== c.id),
                        })
                      }
                    />{" "}
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="hint">Add characters in Setup to mark callbacks.</p>
          )}
          <button className="btn primary big wide" onClick={save}>Save vocal notes</button>
          <span className="saved" role="status">{msg}</span>
        </section>
      </div>
    </div>
  );
}
