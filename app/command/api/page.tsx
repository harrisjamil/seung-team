"use client";

import { FleetPageLoader } from "@/app/components/FleetPageLoader";
import { getSession, type AppSession } from "@/app/lib/auth";
import { CommandHeader } from "@/app/command/components/CommandHeader";
import { FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import { CommandSubpagePanel } from "@/app/command/components/CommandSubpagePanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faKey,
  faMicrochip,
  faRobot,
  faVialCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";

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
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [token, setToken] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "command") {
      router.replace("/");
    }
    window.queueMicrotask(() => {
      setSession(s ?? null);
      setClientReady(true);
    });
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
        if (!cancelled) {
          toast.error("Couldn't load saved API settings.");
        }
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
    setResult(null);
    try {
      const response = await fetch("/api/huggingface/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, model }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!body.ok) {
        toast.error(body.error || "Failed to save API configuration.");
        return;
      }
      toast.success("API configuration saved.");
    } catch {
      toast.error("Unable to save API configuration.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/huggingface/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, model, prompt }),
      });
      const body = (await response.json()) as TestResponse;
      setResult(body);
      if (body.ok) {
        toast.success("Connection test succeeded.");
      } else {
        toast.error(body.error || "Connection test failed.");
      }
    } catch {
      const failed: TestResponse = { ok: false, error: "Unable to reach test endpoint." };
      setResult(failed);
      toast.error(failed.error ?? "Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!clientReady || !session || session.role !== "command") {
    return (
      <FleetPageLoader
        message={!clientReady || !session ? "Loading…" : "Redirecting…"}
      />
    );
  }

  if (loadingConfig) {
    return <FleetPageLoader message="Loading API settings…" />;
  }

  return (
    <div className={FLEET_PAGE_SHELL}>
      <CommandHeader
        connected={false}
        openAlertsCount={0}
        distressedCount={0}
        adverseCount={0}
        router={router}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 sm:gap-6 sm:px-5 sm:py-5 lg:px-6">
        <CommandSubpagePanel
          icon={faRobot}
          title="Add API"
          subtitle="Configure Hugging Face access for AI chat and fleet intelligence features."
          badges={[
            { label: "Inference API", icon: faMicrochip },
            { label: "Secured in Supabase", icon: faKey },
          ]}
        >
          <div className="p-6">
            <form onSubmit={testConnection} className="space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FontAwesomeIcon icon={faKey} className="text-slate-500" />
                  Hugging Face access token
                </span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="hf_xxx…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 text-sm font-medium text-slate-700">Test prompt</span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <FontAwesomeIcon icon={faVialCircleCheck} className="text-sm" />
                  )}
                  {loading ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
                  ) : null}
                  {saving ? "Saving…" : "Save API"}
                </button>
              </div>
            </form>

            {result ? (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
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
            ) : null}
          </div>
        </CommandSubpagePanel>
      </div>
    </div>
  );
}
