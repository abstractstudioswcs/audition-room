"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Headshot } from "@/components/headshot";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { MUSIC_LABEL, missingMusic, type Auditioner, type Session } from "@/lib/types";
import { useProduction, useSessionProduction, type ProductionData } from "@/lib/use-production";

export function Overview() {
  const sessionId = useParams<{ id: string }>().id;
  const { productionId, missing } = useSessionProduction(sessionId);
  const { data, state, live } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={missing ? "missing" : state} live={live} tabs={sessionTabs(sessionId)}>
      {(d) => {
        const session = d.sessions.find((s) => s.id === sessionId);
        if (!session) return <p className="lede">This session was deleted.</p>;
        return <Board d={d} session={session} />;
      }}
    </ProductionFrame>
  );
}

const done = <span className="fit-full" style={{ fontWeight: 600 }}>Done</span>;
const notYet = <span className="hint">Not yet</span>;

function Board({ d, session }: { d: ProductionData; session: Session }) {
  const [everySession, setEverySession] = useState(false);
  const list = everySession ? d.auditioners : d.auditioners.filter((a) => a.session_id === session.id);
  const current = d.auditioners.find((a) => a.id === session.current_auditioner_id && a.status !== "done");
  const sc = (a: Auditioner) => d.scores[a.id];
  const placedOn = (a: Auditioner) =>
    d.castings.filter((x) => x.auditioner_id === a.id).map((x) => ({
      name: d.characters.find((c) => c.id === x.character_id)?.name ?? "?",
      status: x.status,
    }));

  const counts = [
    ["Checked in", list.length],
    ["Waiting", list.filter((a) => a.status === "waiting").length],
    ["Sang", list.filter((a) => a.status === "done").length],
    ["Missing music", list.filter((a) => a.status !== "done" && missingMusic(a)).length],
    ["Vocal notes", list.filter((a) => sc(a)?.rating || sc(a)?.low_note).length],
    ["Acting notes", list.filter((a) => sc(a)?.acting_rating || sc(a)?.acting_notes).length],
    ["On the casting board", list.filter((a) => placedOn(a).length > 0).length],
  ] as const;

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <h1 style={{ fontSize: 30 }}>Overview</h1>
          <p className="lede" style={{ marginTop: 6 }}>
            Where every singer is: check-in, the room, vocal and acting notes, and casting.
            {current ? ` Singing now: ${current.slot} · ${current.name}.` : ""}
          </p>
        </div>
        <div className="inline">
          <span className="hint">Check-in is {session.checkin_open ? "open" : "closed"}</span>
          {d.sessions.length > 1 && (
            <label className="follow" style={{ padding: 0 }}>
              <input type="checkbox" checked={everySession} onChange={(e) => setEverySession(e.target.checked)} /> Show every session
            </label>
          )}
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {counts.map(([label, n]) => (
          <div className="fact" key={label}>
            <span className="label">{label}</span>
            <span className="v">{n}</span>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h2>Nobody has checked in yet</h2>
          <p className="lede">Singers appear here the moment they check in.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Singer", "Music", "In the room", "Vocal", "Acting", "Casting"].map((h) => (
                  <th key={h} scope="col" className="label" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const s = sc(a);
                const placed = placedOn(a);
                const singing = a.id === current?.id;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line)", background: singing ? "var(--accent-soft)" : undefined }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Headshot path={a.headshot_path} name={a.name} size={40} />
                        <span>
                          <strong>{a.slot} · {a.name}</strong>
                          <br />
                          <span className="hint">
                            {a.song}
                            {everySession && d.sessions.length > 1 ? ` · ${d.sessions.find((x) => x.id === a.session_id)?.name}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {missingMusic(a) ? <span className="fit-partial" style={{ fontWeight: 600 }}>Missing</span> : <span>{MUSIC_LABEL[a.music_type]}</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {singing ? <span className="fit-full" style={{ fontWeight: 600 }}>Singing now</span> : a.status === "done" ? "Sang" : "Waiting"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {s?.rating || s?.low_note ? (
                        <span>
                          {done}
                          <br />
                          <span className="hint">
                            {[s.low_note && s.high_note ? `${s.low_note} to ${s.high_note}` : "", s.rating ? `${s.rating} of 5` : ""].filter(Boolean).join(", ")}
                          </span>
                        </span>
                      ) : notYet}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {s?.acting_rating || s?.acting_notes ? (
                        <span>
                          {done}
                          {s.acting_rating ? <><br /><span className="hint">{s.acting_rating} of 5</span></> : null}
                        </span>
                      ) : notYet}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {placed.length ? (
                        <span>
                          {placed.map((p, i) => (
                            <span key={p.name}>
                              {i > 0 ? ", " : ""}
                              {p.status === "cast" ? <strong className="fit-full">{p.name} (cast)</strong> : p.status === "callback" ? `${p.name} (callback)` : p.name}
                            </span>
                          ))}
                          {s?.callback_ids.length ? <><br /><span className="hint">Callback</span></> : null}
                        </span>
                      ) : notYet}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">
        Open any stage from the tabs above. <Link href={`/app/p/${d.production.id}/cast`}>Go to the casting board</Link>.
      </p>
    </div>
  );
}
