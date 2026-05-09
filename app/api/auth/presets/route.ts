import { NextResponse } from "next/server";
import { resolveSupabaseConfig } from "../_shared";

export async function GET() {
  const cfg = await resolveSupabaseConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_URL / key environment variables" },
      { status: 500 },
    );
  }

  let lastError = "Unknown Supabase error";
  const attempts: string[] = [];
  for (const [idx, key] of cfg.keys.entries()) {
    const url = new URL(`${cfg.url}/rest/v1/users`);
    url.searchParams.set("select", "role,username,password");
    url.searchParams.set("role", "in.(command,captain)");
    const headers: Record<string, string> = { apikey: key };
    if (key.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${key}`;
    }
    const res = await fetch(url, {
      headers,
    });
    if (!res.ok) {
      const body = await res.text();
      attempts.push(
        `#${idx + 1}:${key.slice(0, 14)}... status=${res.status} body=${body.slice(0, 90)}`,
      );
      lastError = body;
      continue;
    }
    const data = (await res.json()) as
      | { role: string; username: string; password: string }[]
      | null;

    const command = data?.find((u) => u.role === "command");
    const captain = data?.find((u) => u.role === "captain");

    return NextResponse.json({
      ok: true,
      presets: {
        command: command
          ? { username: String(command.username), password: String(command.password) }
          : null,
        captain: captain
          ? { username: String(captain.username), password: String(captain.password) }
          : null,
      },
    });
  }

  return NextResponse.json(
    { ok: false, error: lastError, attempts, keyCount: cfg.keys.length },
    { status: 500 },
  );
}
