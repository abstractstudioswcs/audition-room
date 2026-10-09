"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { TopBar, type Tab } from "@/components/top-bar";
import type { LoadState, ProductionData } from "@/lib/use-production";

/** Top bar, loading/error states and the live-connection banner for staff views. */
export function ProductionFrame({
  data,
  state,
  live,
  tabs,
  kicker,
  right,
  children,
}: {
  data: ProductionData | null;
  state: LoadState;
  live: boolean;
  tabs?: Tab[] | ((d: ProductionData) => Tab[]);
  kicker?: string;
  right?: ReactNode;
  children: (d: ProductionData) => ReactNode;
}) {
  return (
    <>
      <TopBar
        kicker={kicker ?? data?.theatre.name ?? "Audition Room"}
        title={data?.production.title ?? "Loading…"}
        tabs={data ? (typeof tabs === "function" ? tabs(data) : tabs) : undefined}
        right={right ?? <Link className="switch" href="/app">All productions</Link>}
      />
      {data && !live && (
        <p className="banner" role="status">Live updates paused. Reconnecting, and refreshing every few seconds until then.</p>
      )}
      <main className="page">
        {state === "loading" && <p className="lede">Loading…</p>}
        {(state === "missing" || state === "error") && (
          <div className="empty">
            <h2>{state === "missing" ? "This page isn’t available" : "This didn’t load"}</h2>
            <p className="lede">
              {state === "missing"
                ? "It may have been deleted, or you’re not on this theatre’s team. Join with the team code from the theatre owner."
                : "Check your connection, then reload."}
            </p>
            <Link className="btn" href="/app">Back to your theatres</Link>
          </div>
        )}
        {state === "ready" && data && children(data)}
      </main>
    </>
  );
}

/**
 * Every team member sees every stage. Session pages use their own session;
 * production pages (Setup, Casting) use the most recent session.
 */
function allTabs(d: ProductionData, sessionId: string | null): Tab[] {
  const p = `/app/p/${d.production.id}`;
  const sid = sessionId ?? d.sessions[d.sessions.length - 1]?.id ?? null;
  const s = sid ? `/app/s/${sid}` : null;
  return [
    ...(s
      ? [
          { href: `${s}/overview`, label: "Overview" },
          { href: `${s}/accompanist`, label: "Accompanist" },
          { href: `${s}/music-director`, label: "Vocal" },
          { href: `${s}/acting`, label: "Acting" },
        ]
      : []),
    { href: `${p}/cast`, label: "Casting" },
    { href: `${p}/conflicts`, label: "Conflicts" },
    { href: p, label: "Setup" },
  ];
}

export const productionTabs = () => (d: ProductionData) => allTabs(d, null);
export const sessionTabs = (sessionId: string) => (d: ProductionData) => allTabs(d, sessionId);
