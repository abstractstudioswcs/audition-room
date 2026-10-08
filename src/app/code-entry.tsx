"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="inline"
      style={{ marginTop: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toLowerCase();
        if (c) router.push(`/c/${encodeURIComponent(c)}`);
      }}
    >
      <div className="field" style={{ flex: "1 1 160px" }}>
        <label htmlFor="code">Audition code</label>
        <input
          id="code"
          className="mono"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <button className="btn primary" type="submit" style={{ alignSelf: "flex-end" }}>
        Check in
      </button>
    </form>
  );
}
