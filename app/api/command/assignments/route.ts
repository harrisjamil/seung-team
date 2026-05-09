import { getServerSupabase } from "@/app/lib/server/supabase";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

type FleetFile = { ships?: Array<{ id: string; name: string }> };

async function fleetShipOptions(): Promise<Array<{ ship_id: string; name: string }>> {
  try {
    const fleetPath = join(process.cwd(), "fleet.json");
    const raw = await readFile(fleetPath, "utf8");
    const fleet = JSON.parse(raw) as FleetFile;
    return (fleet.ships ?? []).map((s) => ({ ship_id: s.id, name: s.name }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { data: captains, error: cErr } = await supabase
      .from("users")
      .select("user_id, username, display_name, ship_id")
      .eq("role", "captain")
      .order("display_name", { ascending: true });

    if (cErr) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }

    const ships = await fleetShipOptions();

    return NextResponse.json({
      ok: true,
      captains: captains ?? [],
      ships,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load assignments." },
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
      captainUserId?: string;
      shipId?: string | null;
    };
    const captainUserId = body.captainUserId?.trim();
    const shipId =
      body.shipId === null || body.shipId === undefined
        ? null
        : String(body.shipId).trim() || null;

    if (!captainUserId) {
      return NextResponse.json({ ok: false, error: "captainUserId is required." }, { status: 400 });
    }

    if (shipId) {
      const options = await fleetShipOptions();
      const ok = options.some((s) => s.ship_id === shipId);
      if (!ok) {
        return NextResponse.json({ ok: false, error: "Unknown ship id." }, { status: 400 });
      }
    }

    const { data: row, error } = await supabase
      .from("users")
      .update({ ship_id: shipId })
      .eq("user_id", captainUserId)
      .eq("role", "captain")
      .select("user_id, ship_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ ok: false, error: "Captain not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, captain: row });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update assignment." },
      { status: 500 },
    );
  }
}
