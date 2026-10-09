"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Headshot } from "@/components/headshot";
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
      tabs={sessionTabs(sessionId)}
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
  const [viewing, setViewing] = useState<string | null>(null); // previewing someone who isn't singing yet
  const mine = d.auditioners.filter((a) => a.session_id === session.id);
  const currentRaw = mine.find((a) => a.id === session.current_auditioner_id);
  const current = currentRaw && currentRaw.status !== "done" ? currentRaw : null;
  const waiting = mine.filter((a) => a.status !== "done" && a.id !== current?.id);
  const finished = mine.filter((a) => a.status === "done");
  const next = waiting[0];
  const previewed = viewing && viewing !== current?.id ? mine.find((a) => a.id === viewing) ?? null : null;

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
    setViewing(null);
    run([...(current ? [setStatus(current.id, "waiting")] : []), setStatus(id, "singing"), setCurrent(id)]);
  };
  const done = () => {
    if (!current) return;
    setViewing(null);
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
          const looking = previewed?.id === a.id;
          const cls = ["qi", isNow ? "now" : idx === 0 ? "next" : "", miss && !isNow ? "missing" : ""].join(" ");
          return (
            <button key={a.id} className={cls} onClick={() => setViewing(isNow ? null : a.id)}
              aria-current={isNow ? "true" : undefined} aria-pressed={looking}
              style={looking ? { outline: "3px solid #9DB0FF", outlineOffset: -3 } : undefined}
              aria-label={`${a.slot}, ${a.name}${isNow ? ", singing now" : ", preview their music"}`}>
              <span className="tag">{isNow ? "Now" : tags[idx] ?? "Waiting"}{miss ? " · no music yet" : ""}{looking ? " · previewing" : ""}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Headshot path={a.headshot_path} name={a.name} size={28} />
                <span className="who">{a.slot} · {a.name}</span>
              </span>
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
              <button key={a.id} className="qi" onClick={() => setViewing(a.id)} aria-label={`${a.slot}, ${a.name}, open to call back`}>
                <span className="who">{a.slot} · {a.name}</span>
                <span className="what">Tap to see their music or call back</span>
              </button>
            ))}
          </details>
        )}
      </aside>

      <div className="stage">
        {error && <p className="banner" style={{ margin: 0 }} role="alert">{error}</p>}
        <p className="hint">Tap anyone in the queue to look over their music before you call them.</p>
        {previewed ? (
          <Singer
            a={previewed}
            preview
            busy={busy}
            onCall={() => call(previewed.id)}
            onBack={() => setViewing(null)}
            backLabel={current ? `Back to ${current.slot} · ${current.name}` : "Close preview"}
          />
        ) : !current ? (
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

function Singer({
  a,
  next,
  busy,
  onDone,
  preview = false,
  onCall,
  onBack,
  backLabel,
}: {
  a: Auditioner;
  next?: Auditioner;
  busy: boolean;
  onDone?: () => void;
  preview?: boolean;
  onCall?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const note = midi(a.first_note);
  const cut = a.cut_start || a.cut_end ? `${a.cut_start || "?"} to ${a.cut_end || "?"}` : "—";
  return (
    <>
      {preview && (
        <div className="note" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <span>Previewing {a.slot} · {a.name}. They haven’t been called yet.</span>
          <span className="inline">
            <button className="btn" onClick={onBack}>{backLabel}</button>
            <button className="btn primary" disabled={busy} onClick={onCall}>Call {a.name} now</button>
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Headshot path={a.headshot_path} name={a.name} size={72} />
        <div style={{ minWidth: 0 }}>
          <div className="who">{a.slot} · {a.name}</div>
          <h2>
            {a.song} {a.show && <span>{a.show}</span>}
          </h2>
        </div>
      </div>
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
        {a.files.length > 0 && (
          <MusicFiles
            files={a.files}
            song={`${a.slot} · ${a.name} · ${a.song}`}
            standExtras={
              <>
                {note !== null && (
                  <button type="button" className="stand-btn" onClick={() => playNote(note)}>First note {a.first_note}</button>
                )}
                {a.tempo && (
                  <button type="button" className="stand-btn" onClick={() => countIn(a.tempo!)}>Count in {a.tempo}</button>
                )}
              </>
            }
          />
        )}
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
        {preview ? (
          <button className="btn primary big" disabled={busy} onClick={onCall}>Call {a.slot} · {a.name} now</button>
        ) : (
          <button className="btn primary big" disabled={busy} onClick={onDone}>
            {next ? `Done, call ${next.slot} · ${next.name}` : "Done, end of queue"}
          </button>
        )}
      </div>
    </>
  );
}
