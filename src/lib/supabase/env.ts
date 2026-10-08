// Supabase settings. Accepts both the older and newer key names, so it works
// whether the values were typed in by hand or added by the Vercel ↔ Supabase
// integration. NEXT_PUBLIC_ values must be written out literally so Next.js
// can bake them into the browser bundle.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** The public (anon / publishable) key. Safe in the browser. */
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** The private (service role / secret) key. Server only. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}
