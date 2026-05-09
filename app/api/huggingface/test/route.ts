import { getServerSupabase } from "@/app/lib/server/supabase";
import { NextResponse } from "next/server";

type HuggingFaceTestBody = {
  token?: string;
  model?: string;
  prompt?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HuggingFaceTestBody;
    let token = body.token?.trim();
    let model = body.model?.trim();
    const prompt = body.prompt?.trim() || "What is the capital of France?";

    if (!token || !model) {
      const supabase = getServerSupabase();
      if (supabase) {
        const { data } = await supabase
          .from("api_integrations")
          .select("token, model")
          .eq("provider", "huggingface")
          .maybeSingle();
        token = token || data?.token || "";
        model = model || data?.model || "";
      }
    }

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Hugging Face token is required." },
        { status: 400 },
      );
    }

    if (!model) {
      return NextResponse.json(
        { ok: false, error: "Model is required." },
        { status: 400 },
      );
    }

    const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const payload = (await hfResponse.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!hfResponse.ok) {
      const apiError = payload.error?.message || "Hugging Face request failed.";
      return NextResponse.json({ ok: false, error: apiError }, { status: hfResponse.status });
    }

    const content = payload.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      ok: true,
      model,
      message: content,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error while testing API.",
      },
      { status: 500 },
    );
  }
}
