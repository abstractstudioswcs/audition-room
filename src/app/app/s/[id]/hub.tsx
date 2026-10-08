"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductionFrame, sessionTabs } from "@/components/production-frame";
import { useProduction, useSessionProduction } from "@/lib/use-production";

export const ROLE_KEY = "audition-room:role";

export function rememberRole(role: string) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    // Private browsing: nothing to remember.
  }
}

export function SessionHub() {
  const sessionId = useParams<{ id: string }>().id;
  const { productionId, missing } = useSessionProduction(sessionId);
  const { data, state, live } = useProduction(productionId);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after mount
      setLast(localStorage.getItem(ROLE_KEY));
    } catch {
      setLast(null);
    }
  }, []);

  return (
    <ProductionFrame
      data={data}
      state={missing ? "missing" : state}
      live={live}
      tabs={productionId ? sessionTabs(sessionId, productionId) : []}
    >
      {(d) => {
        const session = d.sessions.find((s) => s.id === sessionId)!;
        const options = [
          { role: "accompanist", href: `/app/s/${sessionId}/accompanist`, title: "Accompanist", body: "See who’s next, with their key, tempo, cut and music ready." },
          { role: "music-director", href: `/app/s/${sessionId}/music-director`, title: "Music director", body: "Log each singer’s range and see who fits which character." },
          { role: "director", href: `/app/p/${d.production.id}/cast`, title: "Director", body: "Place singers on characters and keep casting notes." },
          { role: "setup", href: `/app/p/${d.production.id}`, title: "Setting up the show", body: "Characters, ranges, sessions and check-in links." },
        ];
        return (
          <div className="narrow">
            <section className="panel">
              <p className="hint">{session.name}</p>
              <h1 style={{ fontSize: 30 }}>Who’s using this device?</h1>
              <p className="lede">Pick a view. You can switch from the top bar any time.</p>
              <div className="who-list">
                <a className="who-opt lead" href={`/c/${session.checkin_code}`} onClick={() => rememberRole("kiosk")}>
                  <strong>Check-in kiosk</strong>
                  <span>Hand this device to performers at the door. Each one checks in, then taps “Check in the next person”.</span>
                </a>
                <p className="who-group">Audition team</p>
                {options.map((o) => (
                  <Link key={o.role} className="who-opt" href={o.href} onClick={() => rememberRole(o.role)}
                    style={last === o.role ? { borderColor: "var(--accent)" } : undefined}>
                    <strong>{o.title}</strong>
                    <span>{o.body}{last === o.role ? " Last used on this device." : ""}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        );
      }}
    </ProductionFrame>
  );
}
