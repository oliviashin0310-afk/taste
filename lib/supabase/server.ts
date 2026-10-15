import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseServerClient: SupabaseClient | undefined;

export function createServerSupabaseClient() {
  if (supabaseServerClient) return supabaseServerClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  }

  supabaseServerClient = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return supabaseServerClient;
}
