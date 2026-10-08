"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { TopBar } from "@/components/top-bar";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, Production, Theatre } from "@/lib/types";

type Data = { theatres: Theatre[]; members: Member[]; productions: Production[]; userId: string };

export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return router.replace("/login?next=/app");
    const [t, m, p] = await Promise.all([
      sb.from("theatres").select("*").order("created_at"),
      sb.from("theatre_members").select("*").eq("user_id", u.user.id),
      sb.from("productions").select("*").order("created_at", { ascending: false }),
    ]);
    if (t.error || m.error || p.error) return setError("Your theatres didn’t load. Check your connection and reload.");
    setData({ theatres: t.data, members: m.data, productions: p.data, userId: u.user.id });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data on mount
    load();
  }, [load]);

  return (
    <>
      <TopBar
        kicker="Audition Room"
        title="Your theatres"
        right={
          <button
            className="switch"
            onClick={async () => {
              await supabaseBrowser().auth.signOut();
              router.replace("/");
              router.refresh();
            }}
          >
            Sign out
          </button>
        }
      />
      <main className="page">
        <div className="medium">
          {error && <p className="banner" style={{ margin: 0 }}>{error}</p>}
          {!data && !error && <p className="lede">Loading…</p>}
          {data && data.theatres.length === 0 && (
            <section className="panel">
              <h1 style={{ fontSize: 28 }}>Get started</h1>
              <p className="lede">
                Start a theatre if you’re running auditions. If someone already set one up, ask them for the team code and join.
              </p>
            </section>
          )}
          {data?.theatres.map((t) => (
            <TheatreCard
              key={t.id}
              theatre={t}
              role={data.members.find((m) => m.theatre_id === t.id)?.role ?? "staff"}
              productions={data.productions.filter((p) => p.theatre_id === t.id)}
            />
          ))}
          {data && <StartOrJoin onChange={load} />}
        </div>
      </main>
    </>
  );
}

function TheatreCard({
  theatre,
  role,
  productions,
}: {
  theatre: Theatre;
  role: string;
  productions: Production[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addProduction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!title) return setError("Name the production first.");
    setBusy(true);
    const { data, error: err } = await supabaseBrowser()
      .from("productions")
      .insert({ theatre_id: theatre.id, title })
      .select("id")
      .single();
    setBusy(false);
    if (err || !data) return setError("The production didn’t save. Try again.");
    router.push(`/app/p/${data.id}`);
  }

  return (
    <section className="panel">
      <div className="spread">
        <h2 style={{ fontSize: 26 }}>{theatre.name}</h2>
        <span className="hint">
          Team code <span className="code" style={{ color: "var(--ink)" }}>{theatre.team_code}</span>
        </span>
      </div>
      <p className="hint">
        Share the team code with your accompanist and director so they can join. {role === "owner" ? "You own this theatre." : ""}
      </p>
      {productions.length > 0 ? (
        <div className="stack" style={{ gap: 10 }}>
          {productions.map((p) => (
            <Link key={p.id} className="card-link" href={`/app/p/${p.id}`}>
              <strong>{p.title}</strong>
              <span>Characters, audition sessions and casting</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="lede">No productions yet.</p>
      )}
      <form className="inline" onSubmit={addProduction} noValidate>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor={`np-${theatre.id}`}>New production</label>
          <input id={`np-${theatre.id}`} name="title" placeholder="Spring Musical" maxLength={160} />
        </div>
        <button className="btn primary" type="submit" disabled={busy} style={{ alignSelf: "flex-end" }}>
          Add production
        </button>
      </form>
      <p className="err" role="alert">{error}</p>
    </section>
  );
}

function StartOrJoin({ onChange }: { onChange: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: "create_theatre" | "join_theatre", arg: string) {
    setError("");
    setBusy(true);
    const params = fn === "create_theatre" ? { theatre_name: arg } : { code: arg };
    const { error: err } = await supabaseBrowser().rpc(fn, params);
    setBusy(false);
    if (err) return setError(err.message.includes("team code") ? "That team code doesn’t match a theatre." : "That didn’t save. Try again.");
    onChange();
  }

  return (
    <section className="panel">
      <div className="row2 stack-sm" style={{ gap: 20 }}>
        <form
          className="stack"
          style={{ gap: 10 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (!v) return setError("Name your theatre first.");
            run("create_theatre", v);
            e.currentTarget.reset();
          }}
        >
          <h2 style={{ fontSize: 20 }}>Start a theatre</h2>
          <div className="field">
            <label htmlFor="tn">Theatre or school name</label>
            <input id="tn" name="name" placeholder="Lafayette Society for Performing Arts" maxLength={120} />
          </div>
          <button className="btn primary self-start" type="submit" disabled={busy}>Start theatre</button>
        </form>
        <form
          className="stack"
          style={{ gap: 10 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("code") ?? "").trim();
            if (!v) return setError("Enter the team code first.");
            run("join_theatre", v);
            e.currentTarget.reset();
          }}
        >
          <h2 style={{ fontSize: 20 }}>Join a team</h2>
          <div className="field">
            <label htmlFor="tc">Team code</label>
            <input id="tc" name="code" className="mono" autoCapitalize="characters" autoComplete="off" maxLength={12} />
          </div>
          <button className="btn self-start" type="submit" disabled={busy}>Join team</button>
        </form>
      </div>
      <p className="err" role="alert">{error}</p>
    </section>
  );
}
