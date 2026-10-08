"use client";

import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { axisPct, fit, isNoteOrEmpty, midi, roleSpec, VOICES } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import { missingMusic, type Auditioner, type Session } from "@/lib/types";
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
      tabs={productionId ? sessionTabs(sessionId, productionId) : []}
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
  const mine = d.auditioners.filter((a) => a.session_id === session.id);
  const currentId = session.current_auditioner_id;
  const [picked, setPicked] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [leaveWarn, setLeaveWarn] = useState<string | null>(null);
  const [lastCurrent, setLastCurrent] = useState(currentId);

  // Jump to whoever starts singing, unless there are unsaved notes.
  if (currentId !== lastCurrent) {
    setLastCurrent(currentId);
    if (follow && currentId && !dirty) setPicked(currentId);
  }

  const selectedId =
    (picked && mine.some((a) => a.id === picked) ? picked : null) ??
    (currentId && mine.some((a) => a.id === currentId) ? currentId : null) ??
    mine[mine.length - 1]?.id ??
    null;
  const selected = mine.find((a) => a.id === selectedId) ?? null;

  function pick(id: string) {
    if (id === selectedId) return;
    if (dirty && leaveWarn !== id) {
      setLeaveWarn(id);
      return;
    }
    setLeaveWarn(null);
    setDirty(false);
    setPicked(id);
  }

  return (
    <div className="md">
      <div className="stack" style={{ gap: 8 }}>
        <nav className="mdlist" aria-label="Auditioners">
          {mine.length === 0 && <p className="hint" style={{ padding: 8 }}>Nobody has checked in yet.</p>}
          {mine.map((a) => (
            <button key={a.id} className="li" aria-current={a.id === selectedId} onClick={() => pick(a.id)}>
              <span>{a.slot} · {a.name}</span>
              <Status a={a} d={d} currentId={currentId} />
            </button>
          ))}
        </nav>
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Jump to whoever is singing
        </label>
        {leaveWarn && (
          <p className="err" role="alert" style={{ padding: "0 8px" }}>
            You have unsaved notes. Save them, or tap that name again to leave without saving.
          </p>
        )}
      </div>
      {selected ? (
        <Detail key={selected.id} a={selected} d={d} onDirty={setDirty} refresh={refresh} />
      ) : (
        <div className="empty">
          <h2>No one to score yet</h2>
          <p className="lede">When singers check in, pick one from the list to log their range and notes.</p>
        </div>
      )}
    </div>
  );
}

function Status({ a, d, currentId }: { a: Auditioner; d: ProductionData; currentId: string | null }) {
  const sc = d.scores[a.id];
  if (a.id === currentId && a.status !== "done") return <small className="cb">Singing</small>;
  if (sc?.callback_ids.length) return <small className="cb">Callback</small>;
  if (sc?.rating) return <small>Rated {sc.rating}</small>;
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
    const sb = supabaseBrowser();
    const { error } = on
      ? await sb.from("castings").delete().eq("character_id", characterId).eq("auditioner_id", a.id)
      : await sb.from("castings").insert({ character_id: characterId, auditioner_id: a.id });
    setPlacing(null);
    if (error) setMsg("That casting change didn’t save. Try again.");
    refresh();
  }

  const lo = midi(form.low_note), hi = midi(form.high_note);
  const session = d.sessions.find((s) => s.id === a.session_id);
  const wanted = d.characters.filter((c) => a.character_ids.includes(c.id)).map((c) => c.name);

  return (
    <div className="stack">
      <div>
        <p className="lede">
          {a.slot} · {a.song}{a.show ? ` (${a.show})` : ""}{a.song_key ? ` · ${a.song_key}` : ""}
          {d.sessions.length > 1 && session ? ` · ${session.name}` : ""}
        </p>
        <h2 style={{ fontSize: 34 }}>{a.name}</h2>
        {wanted.length > 0 && <p className="hint" style={{ marginTop: 4 }}>Would like to be considered for {wanted.join(", ")}</p>}
      </div>
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
          <h3 style={{ fontSize: 20 }}>Your notes</h3>
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
          <button className="btn primary big wide" onClick={save}>Save notes</button>
          <span className="saved" role="status">{msg}</span>
        </section>
      </div>
    </div>
  );
}
