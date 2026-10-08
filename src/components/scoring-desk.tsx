"use client";

import { useState, type ReactNode } from "react";
import { Headshot } from "@/components/headshot";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Auditioner, Session } from "@/lib/types";
import type { ProductionData } from "@/lib/use-production";

/** Deletes a check-in along with its uploaded music and headshot. */
export async function removeCheckIn(a: Auditioner): Promise<boolean> {
  const sb = supabaseBrowser();
  const paths = [...a.files.map((f) => f.path), a.headshot_path].filter(Boolean);
  if (paths.length) await sb.storage.from("music").remove(paths);
  const { error } = await sb.from("auditioners").delete().eq("id", a.id);
  return !error;
}

/**
 * The left-hand singer list shared by the Vocal and Acting views. Follows whoever
 * is singing unless the open notes are unsaved.
 */
export function ScoringDesk({
  d,
  session,
  status,
  emptyText,
  refresh,
  children,
}: {
  d: ProductionData;
  session: Session;
  status: (a: Auditioner) => ReactNode;
  emptyText: string;
  refresh: () => void;
  children: (a: Auditioner, onDirty: (v: boolean) => void) => ReactNode;
}) {
  const mine = d.auditioners.filter((a) => a.session_id === session.id);
  const currentId = session.current_auditioner_id;
  const [picked, setPicked] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [leaveWarn, setLeaveWarn] = useState<string | null>(null);
  const [lastCurrent, setLastCurrent] = useState(currentId);
  const [removeArmed, setRemoveArmed] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState("");

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
    if (dirty && leaveWarn !== id) return setLeaveWarn(id);
    setLeaveWarn(null);
    setDirty(false);
    setRemoveArmed(null);
    setPicked(id);
  }

  async function remove(a: Auditioner) {
    if (removeArmed !== a.id) {
      setRemoveArmed(a.id);
      setTimeout(() => setRemoveArmed((cur) => (cur === a.id ? null : cur)), 5000);
      return;
    }
    setRemoveArmed(null);
    setRemoveMsg("Removing…");
    const ok = await removeCheckIn(a);
    setRemoveMsg(ok ? `Removed ${a.name}’s check-in.` : "Not removed. Try again.");
    setDirty(false);
    setPicked(null);
    refresh();
  }

  return (
    <div className="md">
      <div className="stack" style={{ gap: 8 }}>
        <nav className="mdlist" aria-label="Auditioners">
          {mine.length === 0 && <p className="hint" style={{ padding: 8 }}>Nobody has checked in yet.</p>}
          {mine.map((a) => (
            <button key={a.id} className="li" aria-current={a.id === selectedId} onClick={() => pick(a.id)}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Headshot path={a.headshot_path} name={a.name} size={32} />
                <span>{a.slot} · {a.name}</span>
              </span>
              {status(a)}
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
        {selected && (
          <button className="linkbtn" style={{ padding: "0 8px" }} onClick={() => remove(selected)}>
            {removeArmed === selected.id ? `Tap again to remove ${selected.name}’s check-in and music` : `Remove ${selected.name}’s check-in`}
          </button>
        )}
        {removeMsg && <p className="saved" role="status" style={{ padding: "0 8px" }}>{removeMsg}</p>}
      </div>
      {selected ? (
        <div key={selected.id}>{children(selected, setDirty)}</div>
      ) : (
        <div className="empty">
          <h2>No one to score yet</h2>
          <p className="lede">{emptyText}</p>
        </div>
      )}
    </div>
  );
}

/** Photo, name, song and the characters they asked for. */
export function SingerHeader({ a, d }: { a: Auditioner; d: ProductionData }) {
  const session = d.sessions.find((s) => s.id === a.session_id);
  const wanted = d.characters.filter((c) => a.character_ids.includes(c.id)).map((c) => c.name);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Headshot path={a.headshot_path} name={a.name} size={88} />
      <div style={{ minWidth: 0 }}>
        <p className="lede">
          {a.slot} · {a.song}{a.show ? ` (${a.show})` : ""}{a.song_key ? ` · ${a.song_key}` : ""}
          {d.sessions.length > 1 && session ? ` · ${session.name}` : ""}
        </p>
        <h2 style={{ fontSize: 34 }}>{a.name}</h2>
        {wanted.length > 0 && <p className="hint" style={{ marginTop: 4 }}>Would like to be considered for {wanted.join(", ")}</p>}
      </div>
    </div>
  );
}

/** Toggle a singer onto or off a character's casting column. */
export async function toggleCasting(characterId: string, auditionerId: string, on: boolean) {
  const sb = supabaseBrowser();
  const { error } = on
    ? await sb.from("castings").delete().eq("character_id", characterId).eq("auditioner_id", auditionerId)
    : await sb.from("castings").insert({ character_id: characterId, auditioner_id: auditionerId });
  return !error;
}
