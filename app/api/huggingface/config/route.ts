import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

type HuggingFaceConfigBody = {
  token?: string;
  model?: string;
};

export async function GET() {
  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("api_integrations")
      .select("provider, token, model")
      .eq("provider", "huggingface")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      config: data
        ? {
            provider: data.provider,
            token: data.token,
            model: data.model,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load API config." },
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

    const body = (await request.json()) as HuggingFaceConfigBody;
    const token = body.token?.trim();
    const model = body.model?.trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required." }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ ok: false, error: "Model is required." }, { status: 400 });
    }

    const { error } = await supabase.from("api_integrations").upsert(
      {
        provider: "huggingface",
        token,
        model,
      },
      { onConflict: "provider" },
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save API config." },
      { status: 500 },
    );
  }
}
