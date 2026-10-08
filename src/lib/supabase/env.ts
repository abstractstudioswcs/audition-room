// Supabase settings, resolved in next.config.ts from whichever names are set
// (hand-entered NEXT_PUBLIC_ values or the Vercel ↔ Supabase integration's).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/** The public (publishable / anon) key. Safe in the browser. */
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

/** The private (secret / service role) key. Server only. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}
