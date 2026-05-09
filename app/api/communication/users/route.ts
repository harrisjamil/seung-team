import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

type UserRow = {
  user_id: string;
  username: string;
  role: string;
  ship_id: string | null;
  display_name: string;
};

function displayNameForUnlistedPeer(userId: string): string {
  const u = userId.toLowerCase();
  if (u.includes("seung") && u.includes("alert")) return "Seung Alert";
  if (u.endsWith("-alert") || u.includes("fleet-alert")) return "Seung Alert";
  if (u.includes("alert")) return "Alert channel";
  return `Contact (${userId.slice(0, 8)}…)`;
}

export async function GET(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const excludeUserId = searchParams.get("excludeUserId")?.trim();

    let q = supabase
      .from("users")
      .select("user_id, username, role, ship_id, display_name")
      .order("display_name", { ascending: true });

    if (excludeUserId) {
      q = q.neq("user_id", excludeUserId);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows: UserRow[] = [...(data ?? [])];
    const known = new Set(rows.map((r) => r.user_id));

    if (excludeUserId) {
      const { data: dmRows } = await supabase
        .from("direct_messages")
        .select("from_user_id, to_user_id")
        .or(`from_user_id.eq.${excludeUserId},to_user_id.eq.${excludeUserId}`)
        .limit(2000);

      for (const row of dmRows ?? []) {
        const other =
          row.from_user_id === excludeUserId ? row.to_user_id : row.from_user_id;
        if (!other || known.has(other)) continue;
        known.add(other);
        rows.push({
          user_id: other,
          username: other,
          role: "system",
          ship_id: null,
          display_name: displayNameForUnlistedPeer(other),
        });
      }
      rows.sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
      );
    }

    return NextResponse.json({ ok: true, users: rows });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to list users." },
      { status: 500 },
    );
  }
}
