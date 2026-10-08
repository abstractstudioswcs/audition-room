"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Auditioner, Casting, Character, Production, Score, Session, Theatre } from "@/lib/types";

export type ProductionData = {
  theatre: Theatre;
  production: Production;
  characters: Character[];
  sessions: Session[];
  auditioners: Auditioner[];
  scores: Record<string, Score>;
  castings: Casting[];
};

export type LoadState = "loading" | "ready" | "missing" | "error";

/**
 * Everything the audition team needs for one production, kept live.
 * Any change on another device triggers a refetch (data per production is small).
 * If the live connection drops, it polls every 5 seconds until it recovers.
 */
export function useProduction(productionId: string | null) {
  const [data, setData] = useState<ProductionData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [live, setLive] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!productionId) return;
    const sb = supabaseBrowser();
    const { data: production, error: pErr } = await sb.from("productions").select("*").eq("id", productionId).maybeSingle();
    if (pErr) return setState("error");
    if (!production) return setState("missing");
    const [theatre, characters, sessions] = await Promise.all([
      sb.from("theatres").select("*").eq("id", production.theatre_id).single(),
      sb.from("characters").select("*").eq("production_id", productionId).order("sort").order("created_at"),
      sb.from("sessions").select("*").eq("production_id", productionId).order("created_at"),
    ]);
    if (theatre.error || characters.error || sessions.error) return setState("error");
    const sessionIds = sessions.data.map((s) => s.id);
    const charIds = characters.data.map((c) => c.id);
    const auditioners = sessionIds.length
      ? await sb.from("auditioners").select("*").in("session_id", sessionIds).order("slot")
      : { data: [] as Auditioner[], error: null };
    if (auditioners.error) return setState("error");
    const audIds = auditioners.data.map((a) => a.id);
    const [scores, castings] = await Promise.all([
      audIds.length ? sb.from("scores").select("*").in("auditioner_id", audIds) : Promise.resolve({ data: [] as Score[], error: null }),
      charIds.length ? sb.from("castings").select("*").in("character_id", charIds) : Promise.resolve({ data: [] as Casting[], error: null }),
    ]);
    if (scores.error || castings.error) return setState("error");
    const scoreMap: Record<string, Score> = {};
    for (const s of scores.data) scoreMap[s.auditioner_id] = s;
    setData({
      theatre: theatre.data,
      production,
      characters: characters.data,
      sessions: sessions.data,
      auditioners: auditioners.data,
      scores: scoreMap,
      castings: castings.data,
    });
    setState("ready");
  }, [productionId]);

  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 120);
  }, [refresh]);

  useEffect(() => {
    if (!productionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    refresh();
    const sb = supabaseBrowser();
    const channel = sb.channel(`production-${productionId}`);
    for (const table of ["characters", "sessions"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `production_id=eq.${productionId}` }, soon);
    }
    for (const table of ["auditioners", "scores", "castings"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, soon);
    }
    let poll: ReturnType<typeof setInterval> | null = null;
    channel.subscribe((status) => {
      const ok = status === "SUBSCRIBED";
      setLive(ok);
      if (ok && poll) {
        clearInterval(poll);
        poll = null;
        refresh();
      } else if (!ok && !poll && status !== "CLOSED") {
        poll = setInterval(refresh, 5000);
      }
    });
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (poll) clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      sb.removeChannel(channel);
    };
  }, [productionId, refresh, soon]);

  return { data, state, live, refresh };
}

/** Resolve a session id to its production id. */
export function useSessionProduction(sessionId: string) {
  const [productionId, setProductionId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    supabaseBrowser()
      .from("sessions")
      .select("production_id")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProductionId(data.production_id);
        else setMissing(true);
      });
  }, [sessionId]);
  return { productionId, missing };
}
