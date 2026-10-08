"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const raw = useSearchParams().get("next");
  const next = raw && raw.startsWith("/app") ? raw : "/app";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    if (!email || !password) return setError("Enter your email and password.");
    if (mode === "up" && password.length < 8) return setError("Use a password of at least 8 characters.");
    setBusy(true);
    const auth = supabaseBrowser().auth;
    if (mode === "in") {
      const { error: err } = await auth.signInWithPassword({ email, password });
      if (err) {
        setBusy(false);
        return setError(
          err.message.toLowerCase().includes("confirm")
            ? "Confirm your email first. Check your inbox for the link."
            : "That email and password don’t match an account.",
        );
      }
      window.location.assign(next);
      return;
    }
    const { data, error: err } = await auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });
    setBusy(false);
    if (err) return setError(err.message);
    if (data.session) window.location.assign(next);
    else setSent(true);
  }

  if (sent) {
    return (
      <section className="panel">
        <h1 style={{ fontSize: 26 }}>Check your email</h1>
        <p className="lede">We sent a link to confirm your account. Open it on this device, then sign in.</p>
        <button className="btn self-start" onClick={() => { setSent(false); setMode("in"); }}>
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1 style={{ fontSize: 28 }}>{mode === "in" ? "Sign in" : "Create your account"}</h1>
      <p className="lede">
        {mode === "in"
          ? "For accompanists, music directors and directors. Performers don’t need an account."
          : "After signing up, start a theatre or join one with its team code."}
      </p>
      <form onSubmit={submit} noValidate className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
          />
        </div>
        <p className="err" role="alert">{error}</p>
        <button className="btn primary big wide" type="submit" disabled={busy}>
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button className="linkbtn" onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); }}>
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
