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
  tabs?: Tab[];
  kicker?: string;
  right?: ReactNode;
  children: (d: ProductionData) => ReactNode;
}) {
  return (
    <>
      <TopBar
        kicker={kicker ?? data?.theatre.name ?? "Audition Room"}
        title={data?.production.title ?? "Loading…"}
        tabs={data ? tabs : undefined}
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

export function productionTabs(productionId: string): Tab[] {
  return [
    { href: `/app/p/${productionId}`, label: "Setup" },
    { href: `/app/p/${productionId}/cast`, label: "Casting" },
  ];
}

export function sessionTabs(sessionId: string, productionId: string): Tab[] {
  return [
    { href: `/app/s/${sessionId}/accompanist`, label: "Accompanist" },
    { href: `/app/s/${sessionId}/music-director`, label: "Music director" },
    { href: `/app/p/${productionId}/cast`, label: "Casting" },
    { href: `/app/p/${productionId}`, label: "Setup" },
  ];
}
