import { readFile } from "node:fs/promises";
import { join } from "node:path";

function parseEnvValue(src: string, key: string): string | null {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = src.match(re);
  if (!m) return null;
  return m[1]?.trim() || null;
}

async function readEnvLocalFallback() {
  try {
    const p = join(process.cwd(), ".env.local");
    const txt = await readFile(p, "utf8");
    return {
      url: parseEnvValue(txt, "SUPABASE_URL"),
      service: parseEnvValue(txt, "SUPABASE_SERVICE_ROLE_KEY"),
      anon: parseEnvValue(txt, "SUPABASE_ANON_KEY"),
      publishable: parseEnvValue(txt, "SUPABASE_PUBLISHABLE_KEY"),
    };
  } catch {
    return {
      url: null,
      service: null,
      anon: null,
      publishable: null,
    };
  }
}

export async function resolveSupabaseConfig() {
  const fallback = await readEnvLocalFallback();
  const fromEnv = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : null;
  };

  const url = fromEnv(process.env.SUPABASE_URL) ?? fallback.url;

  const keys = [
    fromEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
    fromEnv(process.env.SUPABASE_ANON_KEY),
    fromEnv(process.env.SUPABASE_PUBLISHABLE_KEY),
    fallback.service,
    fallback.anon,
    fallback.publishable,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));

  const uniqueKeys = Array.from(new Set(keys));

  const sanitizedUrl = (url ?? "").trim();
  if (!sanitizedUrl || uniqueKeys.length === 0) return null;

  return { url: sanitizedUrl, keys: uniqueKeys };
}
