"use client";

import { useSignedUrl } from "@/components/music-view";

/** A singer's headshot, or their initials when they didn't upload one. */
export function Headshot({ path, name, size = 44 }: { path: string; name: string; size?: number }) {
  const { url } = useSignedUrl(path);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const box = { width: size, height: size, borderRadius: size > 60 ? 12 : 8, flex: "none" as const };
  if (path && url) {
    // eslint-disable-next-line @next/next/no-img-element -- private signed URL
    return <img src={url} alt={`Headshot of ${name}`} style={{ ...box, objectFit: "cover", background: "var(--soft)" }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        ...box, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-text)",
        fontFamily: "var(--display)", fontWeight: 700, fontSize: Math.round(size * 0.38),
      }}
    >
      {initials || "?"}
    </span>
  );
}
