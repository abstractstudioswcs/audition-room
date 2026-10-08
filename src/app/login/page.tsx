import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Audition Room" };

export default function Login() {
  return (
    <>
      <header className="top">
        <Link className="show" href="/">
          <small>Audition Room</small>
          <strong>Audition team</strong>
        </Link>
      </header>
      <main className="page">
        <div className="narrow">
          <Suspense fallback={<p className="lede">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
