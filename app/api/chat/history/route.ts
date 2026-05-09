import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

const MAX_CONTENT = 32000;
const MAX_BATCH = 40;

export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 80, 1), 200);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }

    // Newest first, then reverse for chronological chat UI (ascending was wrong: limit(100)
    // returned the *oldest* 100 rows, so recent AI replies disappeared after refresh).
    let query = supabase
      .from("chat_bot_history")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.ilike("content", `%${q.replace(/%/g, "\\%")}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data ?? []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return NextResponse.json(
      {
        ok: true,
        messages: rows,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load chat history.",
      },
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
      userId?: string;
      messages?: Array<{ role?: string; content?: string }>;
    };

    const userId = body.userId?.trim();
    const messages = body.messages;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required." }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: "messages array is required." }, { status: 400 });
    }
    if (messages.length > MAX_BATCH) {
      return NextResponse.json(
        { ok: false, error: `At most ${MAX_BATCH} messages per request.` },
        { status: 400 },
      );
    }

    const rows = messages.map((m) => {
      const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
      const content = typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT) : "";
      return { user_id: userId, role, content };
    });

    if (rows.some((r) => !r.role || !r.content)) {
      return NextResponse.json(
        { ok: false, error: "Each message needs role user|assistant and non-empty content." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("chat_bot_history").insert(rows);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save chat history.",
      },
      { status: 500 },
    );
  }
}
