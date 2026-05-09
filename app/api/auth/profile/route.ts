import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("user_id, username, role, ship_id, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      session: {
        userId: data.user_id,
        username: data.username,
        role: data.role,
        shipId: (data.ship_id as string | null) ?? undefined,
        displayName: data.display_name ?? "Operator",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load profile." },
      { status: 500 },
    );
  }
}
