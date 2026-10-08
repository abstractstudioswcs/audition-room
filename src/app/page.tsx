import Link from "next/link";
import { CodeEntry } from "./code-entry";

export default function Welcome() {
  return (
    <>
      <header className="top">
        <div className="show">
          <small>Audition Room</small>
          <strong>Welcome</strong>
        </div>
      </header>
      <main className="page">
        <div className="narrow">
          <section className="panel">
            <h1 style={{ fontSize: 30 }}>Who’s using this device?</h1>
            <p className="lede">Performers don’t need an account. The audition team signs in.</p>
            <div className="who-list">
              <div className="who-opt lead">
                <strong>I’m auditioning</strong>
                <span>Enter the code from the audition sign, or scan its QR code.</span>
                <CodeEntry />
              </div>
              <p className="who-group">Audition team</p>
              <Link className="who-opt" href="/app">
                <strong>Accompanist, music director or director</strong>
                <span>Sign in to run the queue, log ranges and cast.</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
