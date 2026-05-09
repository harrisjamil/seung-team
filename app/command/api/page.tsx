"use client";

import { getSession } from "@/app/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faKey, faRobot, faVialCircleCheck } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4-Pro:novita";
const DEFAULT_PROMPT = "What is the capital of France?";

type TestResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  model?: string;
};

type ConfigResponse = {
  ok: boolean;
  error?: string;
  config?: {
    provider: string;
    token: string;
    model: string;
  } | null;
};

export default function CommandApiPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);
  const [status, setStatus] = useState<{
    kind: "save" | "test";
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "command") {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/huggingface/config");
        const body = (await response.json()) as ConfigResponse;
        if (!cancelled && body.ok && body.config) {
          setToken(body.config.token);
          setModel(body.config.model || DEFAULT_MODEL);
        }
      } catch {
        // Ignore load errors and allow manual input.
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    };
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setStatus(null);
    setResult(null);
    try {
      const response = await fetch("/api/huggingface/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, model }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!body.ok) {
        setStatus({
          kind: "save",
          ok: false,
          text: body.error || "Failed to save API configuration.",
        });
        return;
      }
      setStatus({
        kind: "save",
        ok: true,
        text: "API configuration saved to Supabase.",
      });
    } catch {
      setStatus({
        kind: "save",
        ok: false,
        text: "Unable to save API configuration.",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setStatus(null);

    try {
      const response = await fetch("/api/huggingface/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, model, prompt }),
      });
      const body = (await response.json()) as TestResponse;
      setResult(body);
      setStatus({
        kind: "test",
        ok: body.ok,
        text: body.ok ? "Connection successful." : body.error || "Connection failed.",
      });
    } catch {
      const failed: TestResponse = { ok: false, error: "Unable to reach test endpoint." };
      setResult(failed);
      setStatus({
        kind: "test",
        ok: false,
        text: failed.error ?? "Connection failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 lg:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4">
          <Link
            href="/command"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Back to Command
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Add API</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add your Hugging Face token and model, then test the connection.
          </p>
          {loadingConfig && <p className="mt-2 text-xs text-slate-500">Loading saved API config...</p>}

          <form onSubmit={testConnection} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <FontAwesomeIcon icon={faKey} className="text-slate-500" />
                Hugging Face Access Token
              </span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="hf_xxx..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <FontAwesomeIcon icon={faRobot} className="text-slate-500" />
                Model
              </span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 text-sm font-medium text-slate-700">Test prompt</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faVialCircleCheck} className="text-sm" />
                {loading ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save API"}
              </button>
            </div>
          </form>

          {status && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                status.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <span className="font-semibold">{status.kind === "save" ? "Save API: " : "Test Connection: "}</span>
              {status.text}
            </div>
          )}

          {result && (
            <div
              className={`mt-5 rounded-lg border p-4 text-sm ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <p className="font-semibold">{result.ok ? "Connection successful" : "Connection failed"}</p>
              {result.ok ? (
                <p className="mt-2 whitespace-pre-wrap">{result.message || "No message returned."}</p>
              ) : (
                <p className="mt-2">{result.error || "Unknown error"}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
