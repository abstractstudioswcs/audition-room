import type { NextConfig } from "next";

// Supabase settings can arrive under several names: typed in by hand
// (NEXT_PUBLIC_...) or added by the Vercel ↔ Supabase integration (SUPABASE_URL,
// SUPABASE_PUBLISHABLE_KEY, ...). Vercel withholds "Sensitive" NEXT_PUBLIC_
// values from builds, so prefer the integration's names, which Supabase fills
// in itself, and fall back to the hand-entered ones. Empty strings
// count as missing. These two are public by design; the secret key is never
// listed here and stays server-only.
const pick = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim()) ?? "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick(
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
