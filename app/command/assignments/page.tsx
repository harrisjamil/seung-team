"use client";

import { FleetPageLoader } from "@/app/components/FleetPageLoader";
import { getSession, type AppSession } from "@/app/lib/auth";
import { faShip, faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import { CommandHeader } from "../components/CommandHeader";
import { CommandSubpagePanel } from "../components/CommandSubpagePanel";

type CaptainRow = {
  user_id: string;
  username: string;
  display_name: string;
  ship_id: string | null;
};

type ShipOption = { ship_id: string; name: string };

export default function CommandAssignmentsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [ships, setShips] = useState<ShipOption[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    const res = await fetch("/api/command/assignments", { cache: "no-store" });
    const json = (await res.json()) as {
      ok?: boolean;
      captains?: CaptainRow[];
      ships?: ShipOption[];
      error?: string;
    };
    if (!res.ok || !json.ok) {
      toast.error(json.error ?? "Failed to load assignments.");
      setLoading(false);
      return;
    }
    setCaptains(json.captains ?? []);
    setShips(json.ships ?? []);
    const next: Record<string, string> = {};
    for (const c of json.captains ?? []) {
      next[c.user_id] = c.ship_id ?? "";
    }
    setSelection(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [session, load]);

  const save = async (captainUserId: string) => {
    setSavingId(captainUserId);
    const raw = selection[captainUserId] ?? "";
    const shipId = raw === "" ? null : raw;
    try {
      const res = await fetch("/api/command/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captainUserId, shipId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Update failed.");
        return;
      }
      toast.success("Assignment saved. Captain may need to refresh or re-login to sync the bridge.");
      void load();
    } finally {
      setSavingId(null);
    }
  };

  if (!clientReady || !session || session.role !== "command") {
    return (
      <FleetPageLoader
        message={!clientReady || !session ? "Loading…" : "Redirecting…"}
      />
    );
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
          icon={faUserGroup}
          title="Captain assignments"
          subtitle="Link each captain account to a vessel from the fleet catalog. Unassigned captains have no bridge until you set a ship."
          badges={
            loading
              ? undefined
              : [
                  { label: `${captains.length} captain${captains.length === 1 ? "" : "s"}`, icon: faUserGroup },
                  { label: `${ships.length} ship${ships.length === 1 ? "" : "s"}`, icon: faShip },
                ]
          }
        >
          <div className="p-6">
          {loading ? (
            <FleetPageLoader variant="inline" message="Loading roster…" />
          ) : captains.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No captains in the database.</p>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200">
              {captains.map((c) => (
                <li key={c.user_id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{c.display_name}</p>
                    <p className="text-xs text-slate-500">{c.username}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      value={selection[c.user_id] ?? ""}
                      onChange={(e) =>
                        setSelection((prev) => ({ ...prev, [c.user_id]: e.target.value }))
                      }
                    >
                      <option value="">Unassigned</option>
                      {ships.map((s) => (
                        <option key={s.ship_id} value={s.ship_id}>
                          {s.name} ({s.ship_id})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void save(c.user_id)}
                      disabled={savingId === c.user_id}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {savingId === c.user_id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </CommandSubpagePanel>
      </div>
    </div>
  );
}
