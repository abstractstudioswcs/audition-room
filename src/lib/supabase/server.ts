import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, supabaseSecretKey } from "./env";

/** Supabase client acting as the signed-in user (from cookies). */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  });
}

/**
 * Supabase client with full access. Server-only: used for issuing performers
 * one-time upload links. Never send this key to the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  const key = supabaseSecretKey();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
