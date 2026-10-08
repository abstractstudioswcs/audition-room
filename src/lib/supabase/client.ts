"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** One browser client per tab, shared by every component. */
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  }
  return client;
}
