"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { Eye, EyeOff, Ship, Shield, Waves, Compass, Bot, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeInUp, floating, staggerContainer } from "./lib/animations";
import { appendChatMessages, fetchChatHistory } from "./lib/chatHistoryClient";
import { getChatUserId } from "./lib/chatUserId";
import { clearSession, getSession, setSession, type AppRole } from "./lib/auth";
import toast from "react-hot-toast";
import {
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL,
} from "@/lib/supabasePublicDefaults";
import { ThemeToggle } from "./components/ThemeToggle";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type UserRow = {
  user_id: string;
  username: string;
  password: string;
  role: AppRole;
  ship_id: string | null;
  display_name: string | null;
};

type PresetUserRow = {
  role: string;
  username: string;
  password: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  id?: number;
};

const CHAT_WELCOME: ChatMessage = {
  role: "assistant",
  text: "Hi, I am Seung AI. Ask me anything about your fleet operations.",
};

async function fetchLoginPresets() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set("select", "role,username,password");
  url.searchParams.set("role", "in.(command,captain)");
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error("Failed to load login presets");
  const rows = (await res.json()) as PresetUserRow[];
  const command = rows.find((u) => u.role === "command");
  const captain = rows.find((u) => u.role === "captain");
  return {
    command: command
      ? { username: command.username, password: command.password }
      : null,
    captain: captain
      ? { username: captain.username, password: captain.password }
      : null,
  } as Record<AppRole, { username: string; password: string } | null>;
}

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<AppRole>("command");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("fleet-remember-me") !== "0";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([CHAT_WELCOME]);
  const { data: swrPresets, error: swrPresetError } = useSWR(
    "fleet-login-presets",
    fetchLoginPresets,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );
  const presets = swrPresets ?? { command: null, captain: null };
  const displayError =
    error || (swrPresetError ? "Failed to load login presets" : "");

  const autofill = (targetRole: AppRole) => {
    setRole(targetRole);
    const p = presets[targetRole];
    if (p) {
      setUsername(p.username);
      setPassword(p.password);
      setError("");
      toast.success(`Filled ${targetRole} preset credentials.`);
    } else {
      const msg = `No ${targetRole} login found in users table`;
      setError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    const remembered = window.localStorage.getItem("fleet-remember-me");
    if (remembered === "0") {
      clearSession();
    } else {
      const existing = getSession();
      if (existing?.role === "command") {
        router.replace("/command");
        return;
      }
      if (existing?.role === "captain") {
        router.replace(`/captain?ship=${existing.shipId ?? "BRV-001"}`);
        return;
      }
    }

  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = getChatUserId();
        if (uid === "ssr") return;
        const rows = await fetchChatHistory(uid, { limit: 100 });
        if (cancelled || rows.length === 0) return;
        setChatMessages(
          rows.map((r) => ({ role: r.role, text: r.content, id: r.id })),
        );
      } catch {
        // keep default welcome
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${SUPABASE_URL}/rest/v1/users`);
      url.searchParams.set(
        "select",
        "user_id,username,password,role,ship_id,display_name",
      );
      url.searchParams.set("username", `eq.${username.trim().toLowerCase()}`);
      url.searchParams.set("role", `eq.${role}`);
      url.searchParams.set("limit", "1");
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_KEY },
      });
      if (!res.ok) {
        const msg = "Supabase login query failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      const rows = (await res.json()) as UserRow[];
      const user = rows[0];
      if (!user || user.password !== password) {
        const msg = "Invalid credentials";
        setError(msg);
        toast.error(msg);
        return;
      }
      const session = {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        shipId: user.ship_id ?? undefined,
        displayName: user.display_name ?? "Operator",
      };
      if (rememberMe) {
        setSession(session);
        window.localStorage.setItem("fleet-remember-me", "1");
      } else {
        clearSession();
        window.localStorage.setItem("fleet-remember-me", "0");
      }
      if (session.role === "command") {
        toast.success("Signed in to command.");
        router.push("/command");
      } else {
        toast.success(`Welcome aboard, ${session.displayName}.`);
        router.push(`/captain?ship=${session.shipId ?? "BRV-001"}`);
      }
    } catch {
      const msg = "Network error while logging in";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatLoading) return;

    const userId = getChatUserId();
    setChatMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setChatInput("");
    setChatLoading(true);
    let assistantText = "";
    try {
      const response = await fetch("/api/huggingface/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
      };
      assistantText = body.ok
        ? body.message?.trim() || "No response returned from model."
        : body.error || "Unable to get AI response.";
      if (!body.ok) {
        toast.error(assistantText);
      }
      setChatMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } catch {
      assistantText = "Network error while contacting AI service.";
      toast.error(assistantText);
      setChatMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } finally {
      setChatLoading(false);
    }

    if (userId !== "ssr") {
      try {
        await appendChatMessages(userId, [
          { role: "user", content: prompt },
          { role: "assistant", content: assistantText },
        ]);
      } catch {
        // optional persistence
      }
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-4 py-8 text-slate-900 sm:px-6 sm:py-10 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed right-4 top-4 z-[60] sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl"
          animate={{ x: [0, 35, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 18, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-blue-200/20 blur-3xl"
          animate={{ y: [0, -18, 0], opacity: [0.45, 0.65, 0.45] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        {[...Array(10)].map((_, i) => (
          <motion.span
            key={`bubble-${i}`}
            className="absolute rounded-full bg-sky-400/20"
            style={{
              width: 4 + (i % 4),
              height: 4 + (i % 4),
              left: `${8 + i * 9}%`,
              bottom: `${4 + (i % 3) * 7}%`,
            }}
            animate={{ y: [0, -20 - i * 2, 0], opacity: [0.15, 0.5, 0.15] }}
            transition={{
              duration: 6 + i * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.25,
            }}
          />
        ))}

        <motion.div
          className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-r from-cyan-200/25 via-sky-200/20 to-cyan-200/25"
          animate={{ x: ["-4%", "4%", "-4%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer as any}
        className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl lg:grid-cols-[1.05fr_0.95fr] dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)]"
      >
        <motion.section
          variants={fadeInUp as any}
          className="relative flex flex-col border-b border-slate-200 bg-black p-8 text-white lg:border-b-0 lg:border-r"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,#000000_0%,#05070d_60%,#000000_100%)]" />
          <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.05)_45%,transparent_70%)]" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/90">
                Maritime Security Network
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Operations Access</h1>
            </div>
            <div className="rounded-full border border-cyan-300/35 bg-cyan-300/10 p-2">
              <Waves className="h-4 w-4 text-cyan-200" />
            </div>
          </div>

          <div className="relative z-10 mt-5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
            Strait of Hormuz operations theater
          </div>

          <div className="relative z-10 mt-5 overflow-hidden rounded-2xl border border-slate-600/70 bg-slate-900/40 p-2">
            <AnimatePresence mode="wait">
              <motion.img
                key={role}
                src={role === "command" ? "/role-command.svg" : "/role-captain.svg"}
                alt={role === "command" ? "Command operator portrait" : "Captain portrait"}
                className="h-48 w-full rounded-xl object-cover"
                initial={{ opacity: 0, x: role === "command" ? -24 : 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: role === "command" ? 24 : -24, scale: 0.98 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </AnimatePresence>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-600/70 bg-slate-800/55 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Fleet</div>
              <div className="mt-1 text-sm font-semibold text-white">15 Ships</div>
            </div>
            <div className="rounded-xl border border-slate-600/70 bg-slate-800/55 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Sync</div>
              <div className="mt-1 text-sm font-semibold text-white">Realtime</div>
            </div>
            <div className="rounded-xl border border-slate-600/70 bg-slate-800/55 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Alerting</div>
              <div className="mt-1 text-sm font-semibold text-white">Geofence</div>
            </div>
            <div className="rounded-xl border border-slate-600/70 bg-slate-800/55 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Access</div>
              <div className="mt-1 text-sm font-semibold text-white">Role-Based</div>
            </div>
          </div>

          <motion.div
            variants={floating as any}
            initial="initial"
            animate="animate"
            className="relative z-10 mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-600/80 bg-slate-800/50 px-3 py-1.5 text-slate-200"
          >
            <Ship className="h-5 w-5 text-cyan-300" />
            <Compass className="h-4 w-4 text-sky-300" />
            <span className="text-xs">Live maritime command interface</span>
          </motion.div>
        </motion.section>

        <motion.section variants={fadeInUp as any} className="p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Authentication
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sign in
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose Command or Captain to auto-fill credentials from Supabase.
          </p>

          <motion.div variants={fadeInUp as any} className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => autofill("command")}
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                role === "command"
                  ? "border-sky-600 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Shield className="mr-1.5 h-4 w-4" /> Command
            </button>
            <button
              type="button"
              onClick={() => autofill("captain")}
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                role === "captain"
                  ? "border-violet-600 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Ship className="mr-1.5 h-4 w-4" /> Captain
            </button>
          </motion.div>

          <motion.form variants={fadeInUp as any} onSubmit={submitLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-500 transition focus:border-sky-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                placeholder="command@seung.local"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-500 transition focus:border-sky-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-xl border border-slate-300 p-2.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
              Remember me on this device
            </label>
            {displayError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {displayError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {loading ? "Signing in..." : `Login as ${role}`}
            </button>
          </motion.form>
        </motion.section>
      </motion.div>

      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 dark:border-sky-700 dark:bg-sky-700 dark:hover:bg-sky-600"
        aria-label="Open AI chat"
      >
        <Bot className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-22 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-semibold">Seung AI Assistant</span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-slate-200 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close AI chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-slate-900 text-white dark:bg-sky-700"
                      : "border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {chatLoading && (
                <div className="max-w-[85%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Thinking...
                </div>
              )}
            </div>

            <form onSubmit={sendChat} className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask AI..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-900/50"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
