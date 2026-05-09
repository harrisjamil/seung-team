import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

/**
 * Marks inbound messages from a peer as read for the current user (recipient).
 */
export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      recipientUserId?: string;
      peerUserId?: string;
    };
    const recipientUserId = body.recipientUserId?.trim();
    const peerUserId = body.peerUserId?.trim();

    if (!recipientUserId || !peerUserId) {
      return NextResponse.json(
        { ok: false, error: "recipientUserId and peerUserId are required." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("direct_messages")
      .update({ read_at: now })
      .eq("to_user_id", recipientUserId)
      .eq("from_user_id", peerUserId)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to mark read." },
      { status: 500 },
    );
  }
}
