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

    const { count, error } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("to_user_id", userId)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, count: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to count unread." },
      { status: 500 },
    );
  }
}
