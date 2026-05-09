/**
 * Public Supabase URL + publishable key used when env vars are unset.
 * Matches browser fallbacks in useSupabaseShips / supabaseBrowser so server
 * API routes work on hosts (e.g. Vercel) with zero env configuration.
 * Replace with your project in production via environment variables.
 */
export const PUBLIC_SUPABASE_URL = "https://cgercjszxdewcxkwtded.supabase.co";
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_s13hH-GbWW95GxfTMXEwgg_XNwcZ8iB";
