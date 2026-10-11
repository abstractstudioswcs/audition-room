"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ProductionFrame, productionTabs } from "@/components/production-frame";
import { isNoteOrEmpty, VOICES } from "@/lib/music";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Character, Session } from "@/lib/types";
import { useProduction, type ProductionData } from "@/lib/use-production";

export function Setup() {
  const productionId = useParams<{ id: string }>().id;
  const { data, state, live, refresh } = useProduction(productionId);
  return (
    <ProductionFrame data={data} state={state} live={live} tabs={productionTabs()}>
      {(d) => (
        <div className="medium">
          <TitlePanel d={d} onSaved={refresh} />
          <SessionsPanel d={d} onSaved={refresh} />
          <CharactersPanel d={d} onSaved={refresh} />
          <RehearsalPanel d={d} onSaved={refresh} />
        </div>
      )}
    </ProductionFrame>
  );
}

function TitlePanel({ d, onSaved }: { d: ProductionData; onSaved: () => void }) {
  const [title, setTitle] = useState(d.production.title);
  const [msg, setMsg] = useState("");
  const dirty = title.trim() !== d.production.title;
  return (
    <section className="panel">
      <h1 style={{ fontSize: 28 }}>Set up auditions</h1>
      <p className="lede">
        Add the characters you’re casting, then make an audition session. Each session gets its own check-in link for performers.
      </p>
      <form
        className="inline"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return setMsg("Give the production a name.");
          setMsg("Saving…");
          const { error } = await supabaseBrowser().from("productions").update({ title: title.trim() }).eq("id", d.production.id);
          setMsg(error ? "Not saved. Try again." : "Saved");
          onSaved();
        }}
      >
        <div className="field" style={{ flex: "1 1 260px" }}>
          <label htmlFor="ptitle">Production</label>
          <input id="ptitle" value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); setMsg(""); }} />
        </div>
        <button className="btn" type="submit" disabled={!dirty} style={{ alignSelf: "flex-end" }}>Rename</button>
        <span className="saved" role="status">{msg}</span>
      </form>
    </section>
  );
}

/* ---------- rehearsal schedule ---------- */

function RehearsalPanel({ d }: { d: ProductionData; onSaved: () => void }) {
  const n = d.events.length;
  return (
    <section className="panel">
      <h2 style={{ fontSize: 22 }}>Rehearsal schedule</h2>
      <p className="hint">
        Build the rehearsal calendar in the Schedule tab. Performers see it at check-in and tap the days they can’t make.
      </p>
      <p>{n ? `${n} ${n === 1 ? "date" : "dates"} on the calendar.` : "No dates on the calendar yet."}</p>
      <Link className="btn primary self-start" href={`/app/p/${d.production.id}/schedule`}>
        {n ? "Open the schedule" : "Build the schedule"}
      </Link>
    </section>
  );
}

/* ---------- characters ---------- */

type Row = Pick<Character, "name" | "voice" | "low_note" | "high_note" | "notes"> & { id: string; isNew?: boolean };

const toRow = (c: Character): Row => ({
  id: c.id, name: c.name, voice: c.voice, low_note: c.low_note, high_note: c.high_note, notes: c.notes,
});
const blankRow = (): Row => ({ id: crypto.randomUUID(), isNew: true, name: "", voice: "", low_note: "", high_note: "", notes: "" });

function CharactersPanel({ d, onSaved }: { d: ProductionData; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null); // null = not edited, show saved data
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const shown = rows ?? (d.characters.length ? d.characters.map(toRow) : [blankRow()]);

  const edit = (id: string, patch: Partial<Row>) => {
    setRows(shown.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setMsg("");
  };

  async function save() {
    setError("");
    const keep = shown.filter((r) => r.name.trim());
    const bad = keep.find((r) => !isNoteOrEmpty(r.low_note) || !isNoteOrEmpty(r.high_note));
    if (bad) return setError(`Check the range for ${bad.name}. Use note names like G3 or Bb4.`);
    setMsg("Saving…");
    const sb = supabaseBrowser();
    const removed = d.characters.filter((c) => !keep.some((r) => r.id === c.id));
    const results = await Promise.all([
      ...removed.map((c) => sb.from("characters").delete().eq("id", c.id)),
      ...keep.map((r, i) => {
        const fields = {
          name: r.name.trim(), voice: r.voice, low_note: r.low_note.trim(), high_note: r.high_note.trim(), notes: r.notes.trim(), sort: i,
        };
        return r.isNew
          ? sb.from("characters").insert({ id: r.id, production_id: d.production.id, ...fields })
          : sb.from("characters").update(fields).eq("id", r.id);
      }),
    ]);
    if (results.some((x) => x.error)) {
      setMsg("");
      return setError("Some changes didn’t save. Check your connection and save again.");
    }
    setRows(null);
    setMsg("Saved");
    onSaved();
  }

  return (
    <section className="panel">
      <h2 style={{ fontSize: 22 }}>Characters</h2>
      <p className="hint">
        Note names use middle C = C4. Fill in only what matters: a top note alone works, like “Tenor, up to G4”.
      </p>
      <div className="stack" style={{ gap: 10 }}>
        {shown.map((r) => (
          <div className="rolerow" key={r.id}>
            <div className="field f-name">
              <label htmlFor={`n-${r.id}`}>Character</label>
              <input id={`n-${r.id}`} value={r.name} maxLength={80} onChange={(e) => edit(r.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`v-${r.id}`}>Voice type</label>
              <select id={`v-${r.id}`} value={r.voice} onChange={(e) => edit(r.id, { voice: e.target.value })}>
                <option value="">Any</option>
                {VOICES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`l-${r.id}`}>Lowest note</label>
              <input id={`l-${r.id}`} className="mono" placeholder="optional" value={r.low_note} maxLength={4}
                onChange={(e) => edit(r.id, { low_note: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`h-${r.id}`}>Top note</label>
              <input id={`h-${r.id}`} className="mono" placeholder="G4" value={r.high_note} maxLength={4}
                onChange={(e) => edit(r.id, { high_note: e.target.value })} />
            </div>
            <button className="iconbtn" type="button" aria-label={`Remove ${r.name || "character"}`}
              onClick={() => { setRows(shown.filter((x) => x.id !== r.id)); setMsg(""); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="field f-notes">
              <label htmlFor={`t-${r.id}`}>What you need (optional)</label>
              <input id={`t-${r.id}`} placeholder="Comic timing, strong mover, falsetto ok" value={r.notes} maxLength={300}
                onChange={(e) => edit(r.id, { notes: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <button className="btn self-start" type="button" onClick={() => setRows([...shown, blankRow()])}>Add a character</button>
      <p className="err" role="alert">{error}</p>
      <div className="inline">
        <button className="btn primary big" type="button" onClick={save} disabled={rows === null}>Save characters</button>
        <span className="saved" role="status">{rows !== null && !msg ? "Unsaved changes" : msg}</span>
      </div>
    </section>
  );
}

/* ---------- sessions ---------- */

function SessionsPanel({ d, onSaved }: { d: ProductionData; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <h2 style={{ fontSize: 22 }}>Audition sessions</h2>
      <p className="hint">One session per day or room, such as “Saturday” or “Callbacks”. Casting is shared across all of them.</p>
      {d.sessions.length === 0 && <p className="lede">No sessions yet. Make one to get a check-in link.</p>}
      <div>
        {d.sessions.map((s) => (
          <SessionRow key={s.id} s={s} count={d.auditioners.filter((a) => a.session_id === s.id).length} d={d} onSaved={onSaved} />
        ))}
      </div>
      <form
        className="inline"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const n = name.trim() || (d.sessions.length ? `Session ${d.sessions.length + 1}` : "Auditions");
          const { error: err } = await supabaseBrowser().from("sessions").insert({ production_id: d.production.id, name: n });
          if (err) return setError("The session didn’t save. Try again.");
          setName("");
          onSaved();
        }}
      >
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="sname">New session</label>
          <input id="sname" placeholder="Saturday" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-end" }}>Add session</button>
      </form>
      <p className="err" role="alert">{error}</p>
    </section>
  );
}

function SessionRow({ s, count, d, onSaved }: { s: Session; count: number; d: ProductionData; onSaved: () => void }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only available after mount
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/c/${s.checkin_code}`;

  async function clearSession() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    setMsg("Clearing…");
    const sb = supabaseBrowser();
    const paths = d.auditioners.filter((a) => a.session_id === s.id).flatMap((a) => [...a.files.map((f) => f.path), a.headshot_path].filter(Boolean));
    if (paths.length) await sb.storage.from("music").remove(paths);
    const { error } = await sb.from("auditioners").delete().eq("session_id", s.id);
    setMsg(error ? "Not cleared. Try again." : "Cleared");
    onSaved();
  }

  return (
    <div className="sessrow">
      <div className="spread">
        <h3 style={{ fontSize: 20 }}>{s.name}</h3>
        <span className="hint">{count === 1 ? "1 check-in" : `${count} check-ins`}</span>
      </div>
      <div className="inline">
        <Link className="btn primary" href={`/app/s/${s.id}`}>Open session</Link>
        <button className="btn" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
        }}>{copied ? "Link copied" : "Copy check-in link"}</button>
        <button className="btn" type="button" aria-expanded={!!qr} onClick={async () => {
          if (qr) return setQr(null);
          setQr(await QRCode.toDataURL(link, { margin: 1, width: 440 }));
        }}>{qr ? "Hide QR code" : "Show QR code"}</button>
      </div>
      <p className="hint">
        Check-in link: <a href={link} target="_blank" rel="noopener">{link || `/c/${s.checkin_code}`}</a> · code{" "}
        <span className="code" style={{ fontSize: 15, color: "var(--ink)" }}>{s.checkin_code}</span>
      </p>
      {qr && (
        <div className="stack" style={{ gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img className="qr" src={qr} alt={`QR code for the ${s.name} check-in link`} />
          <p className="hint">Print or screenshot this for the hallway. Performers scan it to check in.</p>
        </div>
      )}
      <div className="inline">
        <label className="follow" style={{ padding: 0 }}>
          <input
            type="checkbox"
            checked={s.checkin_open}
            onChange={async (e) => {
              await supabaseBrowser().from("sessions").update({ checkin_open: e.target.checked }).eq("id", s.id);
              onSaved();
            }}
          />
          Check-in is open
        </label>
        <button className="btn danger small" type="button" onClick={clearSession} disabled={count === 0}>
          {armed ? "Tap again to delete every check-in" : "Clear check-ins"}
        </button>
        <span className="saved" role="status">{msg}</span>
      </div>
    </div>
  );
}
