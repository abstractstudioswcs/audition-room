"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { MusicFiles } from "@/components/music-view";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { countIn, playNote } from "@/lib/audio";
import { midi } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MUSIC_LABEL, missingMusic, type Auditioner, type Session } from "@/lib/types";
import { useProduction, useSessionProduction, type ProductionData } from "@/lib/use-production";

export function Accompanist() {
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
        return <Room d={d} session={session} refresh={refresh} />;
      }}
    </ProductionFrame>
  );
}

function Room({ d, session, refresh }: { d: ProductionData; session: Session; refresh: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = d.auditioners.filter((a) => a.session_id === session.id);
  const currentRaw = mine.find((a) => a.id === session.current_auditioner_id);
  const current = currentRaw && currentRaw.status !== "done" ? currentRaw : null;
  const waiting = mine.filter((a) => a.status !== "done" && a.id !== current?.id);
  const finished = mine.filter((a) => a.status === "done");
  const next = waiting[0];

  async function run(steps: Array<() => PromiseLike<{ error: unknown }>>) {
    setBusy(true);
    setError("");
    for (const step of steps) {
      const { error: err } = await step();
      if (err) {
        setError("That change didn’t save. Check your connection and try again.");
        break;
      }
    }
    setBusy(false);
    refresh();
  }

  const sb = supabaseBrowser();
  const setStatus = (id: string, status: Auditioner["status"]) => () => sb.from("auditioners").update({ status }).eq("id", id);
  const setCurrent = (id: string | null) => () => sb.from("sessions").update({ current_auditioner_id: id }).eq("id", session.id);

  const call = (id: string) => {
    if (busy || id === current?.id) return;
    run([...(current ? [setStatus(current.id, "waiting")] : []), setStatus(id, "singing"), setCurrent(id)]);
  };
  const done = () => {
    if (!current) return;
    run([setStatus(current.id, "done"), ...(next ? [setStatus(next.id, "singing")] : []), setCurrent(next?.id ?? null)]);
  };

  const tags = ["Next", "On deck"];
  const queue = (current ? [current] : []).concat(waiting);

  return (
    <div className="acc">
      <aside className="queue" aria-label="Queue">
        <h2>
          Queue <small>{mine.length ? `${finished.length + (current ? 1 : 0)} of ${mine.length}` : "Empty"}</small>
        </h2>
        {queue.length === 0 && <p style={{ color: "var(--side-muted)" }}>{mine.length ? "Everyone has sung." : "Nobody has checked in yet."}</p>}
        {queue.map((a, i) => {
          const isNow = a.id === current?.id;
          const idx = current ? i - 1 : i;
          const miss = missingMusic(a);
          const cls = ["qi", isNow ? "now" : idx === 0 ? "next" : "", miss && !isNow ? "missing" : ""].join(" ");
          return (
            <button key={a.id} className={cls} onClick={() => call(a.id)} aria-current={isNow ? "true" : undefined}
              aria-label={`${a.slot}, ${a.name}${isNow ? ", singing now" : ", call now"}`}>
              <span className="tag">{isNow ? "Now" : tags[idx] ?? "Waiting"}{miss ? " · no music yet" : ""}</span>
              <span className="who">{a.slot} · {a.name}</span>
              <span className="what">{a.song} · {MUSIC_LABEL[a.music_type]}</span>
            </button>
          );
        })}
        {finished.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: "var(--side-muted)", minHeight: 44, display: "flex", alignItems: "center" }}>
              Already sang ({finished.length})
            </summary>
            {finished.map((a) => (
              <button key={a.id} className="qi" onClick={() => call(a.id)} aria-label={`${a.slot}, ${a.name}, call back`}>
                <span className="who">{a.slot} · {a.name}</span>
                <span className="what">Tap to call back</span>
              </button>
            ))}
          </details>
        )}
      </aside>

      <div className="stage">
        {error && <p className="banner" style={{ margin: 0 }} role="alert">{error}</p>}
        {!current ? (
          <div className="empty">
            <h2>{next ? "Ready when you are" : "Waiting for check-ins"}</h2>
            <p className="lede">
              {next ? `${next.slot} · ${next.name} is first in line.` : "Singers show up here as soon as they check in."}
            </p>
            {next && (
              <button className="btn primary big" disabled={busy} onClick={() => call(next.id)}>
                Call {next.slot} · {next.name}
              </button>
            )}
          </div>
        ) : (
          <Singer a={current} next={next} busy={busy} onDone={done} />
        )}
      </div>
    </div>
  );
}

function Singer({ a, next, busy, onDone }: { a: Auditioner; next?: Auditioner; busy: boolean; onDone: () => void }) {
  const note = midi(a.first_note);
  const cut = a.cut_start || a.cut_end ? `${a.cut_start || "?"} to ${a.cut_end || "?"}` : "—";
  return (
    <>
      <div className="who">{a.slot} · {a.name}</div>
      <h2>
        {a.song} {a.show && <span>{a.show}</span>}
      </h2>
      <div className="facts">
        <div className="fact">
          <span className="label">Key</span>
          <span className="v">{a.song_key || "—"}</span>
        </div>
        <div className="fact">
          <span className="label">First note</span>
          <span className="v">{a.first_note || "—"}</span>
          {note !== null && <button className="btn" onClick={() => playNote(note)}>Play it</button>}
        </div>
        <div className="fact">
          <span className="label">Tempo</span>
          <span className="v">{a.tempo ? `${a.tempo} BPM` : "—"}</span>
          {a.tempo && <button className="btn" onClick={() => countIn(a.tempo!)}>Count in</button>}
        </div>
        <div className="fact">
          <span className="label">Cut</span>
          <span className="v" style={{ fontSize: 20 }}>{cut}</span>
        </div>
      </div>
      {a.note && <div className="note">Singer’s note: {a.note}</div>}
      <section className="music" aria-label="Music">
        {a.files.length > 0 && <MusicFiles files={a.files} song={a.song} />}
        {a.music_type === "link" && a.track_link && (
          <>
            <a className="btn primary self-start" href={a.track_link} target="_blank" rel="noopener noreferrer">Open their track</a>
            <p className="hint" style={{ overflowWrap: "anywhere" }}>{a.track_link}</p>
          </>
        )}
        {a.music_type === "phone" && <p>Track is on the singer’s phone. Have them plug in at the piano.</p>}
        {missingMusic(a) && <div className="missing-box">No music uploaded. Ask for their book at the door.</div>}
      </section>
      <div className="actions">
        <button className="btn primary big" disabled={busy} onClick={onDone}>
          {next ? `Done, call ${next.slot} · ${next.name}` : "Done, end of queue"}
        </button>
      </div>
    </>
  );
}
