import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

const MAX_BODY = 8000;

export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const me = searchParams.get("userId")?.trim();
    const peer = searchParams.get("peerUserId")?.trim();

    if (!me || !peer) {
      return NextResponse.json(
        { ok: false, error: "userId and peerUserId are required." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("direct_messages")
      .select("id, from_user_id, to_user_id, body, created_at")
      .or(
        `and(from_user_id.eq.${me},to_user_id.eq.${peer}),and(from_user_id.eq.${peer},to_user_id.eq.${me})`,
      )
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, messages: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load messages." },
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
      fromUserId?: string;
      toUserId?: string;
      body?: string;
    };

    const fromUserId = body.fromUserId?.trim();
    const toUserId = body.toUserId?.trim();
    const text = typeof body.body === "string" ? body.body.trim() : "";

    if (!fromUserId || !toUserId) {
      return NextResponse.json(
        { ok: false, error: "fromUserId and toUserId are required." },
        { status: 400 },
      );
    }
    if (fromUserId === toUserId) {
      return NextResponse.json({ ok: false, error: "Cannot message yourself." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ ok: false, error: "Message body is required." }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json({ ok: false, error: "Message too long." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        body: text.slice(0, MAX_BODY),
      })
      .select("id, from_user_id, to_user_id, body, created_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send message.",
      },
      { status: 500 },
    );
  }
}
