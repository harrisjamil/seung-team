import { getServerSupabase } from "@/app/lib/server/supabase";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

type Role = "command" | "captain";

async function fleetShipIds(): Promise<Set<string>> {
  try {
    const fleetPath = join(process.cwd(), "fleet.json");
    const raw = await readFile(fleetPath, "utf8");
    const fleet = JSON.parse(raw) as { ships?: Array<{ id: string }> };
    return new Set((fleet.ships ?? []).map((s) => s.id));
  } catch {
    return new Set();
  }
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("user_id, username, role, ship_id, display_name, created_at")
      .order("display_name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, users: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to list users." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: string;
      shipId?: string | null;
    };

    const username = body.username?.trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = body.displayName?.trim() ?? "";
    const role = body.role === "captain" ? "captain" : "command";
    let shipId =
      role === "captain" && body.shipId != null && String(body.shipId).trim()
        ? String(body.shipId).trim()
        : null;

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { ok: false, error: "Username, password, and display name are required." },
        { status: 400 },
      );
    }

    if (shipId) {
      const valid = await fleetShipIds();
      if (!valid.has(shipId)) {
        return NextResponse.json({ ok: false, error: "Invalid ship id." }, { status: 400 });
      }
    }

    const userId = randomUUID();

    const { data, error } = await supabase
      .from("users")
      .insert({
        user_id: userId,
        username,
        password,
        role,
        ship_id: role === "captain" ? shipId : null,
        display_name: displayName,
      })
      .select("user_id, username, role, ship_id, display_name, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create user." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      userId?: string;
      username?: string;
      password?: string;
      displayName?: string;
      role?: string;
      shipId?: string | null;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }

    const username = body.username?.trim().toLowerCase();
    const displayName = body.displayName?.trim();
    const role: Role = body.role === "captain" ? "captain" : "command";
    const password = typeof body.password === "string" ? body.password : "";
    const shipId =
      role === "captain" && body.shipId != null && String(body.shipId).trim()
        ? String(body.shipId).trim()
        : null;

    if (!username || !displayName) {
      return NextResponse.json(
        { ok: false, error: "Username and display name are required." },
        { status: 400 },
      );
    }

    if (role === "captain" && shipId) {
      const valid = await fleetShipIds();
      if (!valid.has(shipId)) {
        return NextResponse.json({ ok: false, error: "Invalid ship id." }, { status: 400 });
      }
    }

    const payload: Record<string, unknown> = {
      username,
      display_name: displayName,
      role,
      ship_id: role === "captain" ? shipId : null,
    };

    if (password.length > 0) {
      payload.password = password;
    }

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("user_id", userId)
      .select("user_id, username, role, ship_id, display_name, created_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update user." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as { userId?: string; currentUserId?: string };
    const userId = body.userId?.trim();
    const currentUserId = body.currentUserId?.trim();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }

    if (currentUserId && userId === currentUserId) {
      return NextResponse.json({ ok: false, error: "You cannot delete your own account." }, { status: 400 });
    }

    const { data: deleted, error } = await supabase
      .from("users")
      .delete()
      .eq("user_id", userId)
      .select("user_id");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!deleted?.length) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete user." },
      { status: 500 },
    );
  }
}
