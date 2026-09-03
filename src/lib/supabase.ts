import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as
  string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

let client: SupabaseClient | null = null;

/**
 * Creates the browser-safe client only when a cloud feature needs it.
 * The first arcade release intentionally keeps fictional balance and outcomes local.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  client ??= createClient(supabaseUrl, supabasePublishableKey);
  return client;
}
