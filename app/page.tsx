"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { Eye, EyeOff, Ship, Shield, Waves, Compass } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeInUp, floating, staggerContainer } from "./lib/animations";
import { clearSession, getSession, setSession, type AppRole } from "./lib/auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://cgercjszxdewcxkwtded.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_s13hH-GbWW95GxfTMXEwgg_XNwcZ8iB";

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
    } else {
      setError(`No ${targetRole} login found in users table`);
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
        setError("Supabase login query failed");
        return;
      }
      const rows = (await res.json()) as UserRow[];
      const user = rows[0];
      if (!user || user.password !== password) {
        setError("Invalid credentials");
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
      if (session.role === "command") router.push("/command");
      else router.push(`/captain?ship=${session.shipId ?? "BRV-001"}`);
    } catch {
      setError("Network error while logging in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-slate-900">
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
        className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] lg:grid-cols-[1.05fr_0.95fr]"
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Authentication
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose Command or Captain to auto-fill credentials from Supabase.
          </p>

          <motion.div variants={fadeInUp as any} className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => autofill("command")}
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                role === "command"
                  ? "border-sky-600 bg-sky-50 text-sky-700 shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Shield className="mr-1.5 h-4 w-4" /> Command
            </button>
            <button
              type="button"
              onClick={() => autofill("captain")}
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                role === "captain"
                  ? "border-violet-600 bg-violet-50 text-violet-700 shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Ship className="mr-1.5 h-4 w-4" /> Captain
            </button>
          </motion.div>

          <motion.form variants={fadeInUp as any} onSubmit={submitLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-500 transition focus:border-sky-400 focus:ring-2"
                placeholder="command@seung.local"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-500 transition focus:border-sky-400 focus:ring-2"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-xl border border-slate-300 p-2.5 text-slate-600 transition hover:bg-slate-50"
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
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Remember me on this device
            </label>
            {displayError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {displayError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : `Login as ${role}`}
            </button>
          </motion.form>
        </motion.section>
      </motion.div>
    </main>
  );
}
