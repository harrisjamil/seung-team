import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for Realtime (uses publishable / anon key).
 * Enable RLS policies that allow your app users to read/write as needed.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://cgercjszxdewcxkwtded.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "sb_publishable_s13hH-GbWW95GxfTMXEwgg_XNwcZ8iB";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
