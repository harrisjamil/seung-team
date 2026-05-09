import { NextResponse } from "next/server";
import { resolveSupabaseConfig } from "../_shared";

type Role = "command" | "captain";

export async function POST(req: Request) {
  const cfg = await resolveSupabaseConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_URL / key environment variables" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    username?: string;
    password?: string;
    role?: Role;
  };
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role === "captain" ? "captain" : "command";
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password required" }, { status: 400 });
  }

  let lastError = "Invalid credentials";
  for (const key of cfg.keys) {
    const url = new URL(`${cfg.url}/rest/v1/users`);
    url.searchParams.set(
      "select",
      "user_id,username,password,role,ship_id,display_name",
    );
    url.searchParams.set("username", `eq.${username}`);
    url.searchParams.set("role", `eq.${role}`);
    url.searchParams.set("limit", "1");
    const headers: Record<string, string> = { apikey: key };
    if (key.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${key}`;
    }
    const res = await fetch(url, {
      headers,
    });
    if (!res.ok) {
      lastError = await res.text();
      continue;
    }
    const rows = (await res.json()) as Array<{
      user_id: string;
      username: string;
      password: string;
      role: Role;
      ship_id: string | null;
      display_name: string | null;
    }>;
    const data = rows[0];
    if (!data || data.password !== password) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      session: {
        userId: data.user_id as string,
        username: data.username as string,
        role: data.role as Role,
        shipId: (data.ship_id as string | null) ?? undefined,
        displayName: (data.display_name as string | null) ?? "Operator",
      },
    });
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: 500 });
}
