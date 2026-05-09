"use client";

import { FleetMap } from "@/components/FleetMap";
import { clearSession, getSession } from "@/app/lib/auth";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useFleetWs } from "@/lib/useFleetWs";
import { useSupabaseShips } from "@/lib/useSupabaseShips";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";

function CaptainInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialShip = sp.get("ship") ?? "BRV-001";
  const [shipId, setShipId] = useState(initialShip);
  const { connected, latest, displayShips, bbox, send } = useFleetWs({
    role: "captain",
    shipId,
  });
  const { ships: supabaseShips } = useSupabaseShips();
  const [msg, setMsg] = useState("");

  const ships = useMemo((): FleetShipRuntime[] => {
    if (displayShips.length) return displayShips;
    if (latest?.ships?.length) return latest.ships;
    return supabaseShips;
  }, [displayShips, latest?.ships, supabaseShips]);

  const myShip = useMemo(() => ships.find((s) => s.id === shipId), [ships, shipId]);

  const pending = useMemo(
    () =>
      (latest?.directives ?? []).filter(
        (d) => d.shipId === shipId && !d.response,
      ),
    [latest?.directives, shipId],
  );

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "captain") {
      router.replace("/");
      return;
    }
    if (s.shipId && s.shipId !== shipId) {
      setShipId(s.shipId);
      router.replace(`/captain?ship=${s.shipId}`);
    }
  }, [router, shipId]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-950 p-4 text-slate-50 lg:p-5">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Captain console</h1>
            <p className="text-sm text-slate-400">
              Ship-scoped operational interface · {connected ? "live telemetry" : "connecting…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-slate-400">Ship</label>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
              value={shipId}
              onChange={(e) => setShipId(e.target.value)}
            >
              {(latest?.ships ?? ships).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
            <Link href="/command" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">
              Command
            </Link>
            <Link href="/" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">
              Home
            </Link>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push("/");
              }}
              className="rounded-md border border-rose-700/70 px-3 py-1.5 text-rose-200 hover:bg-rose-950/40"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_340px]">
        <FleetMap
          bbox={bbox}
          ships={ships}
          zones={latest?.zones ?? []}
          selectedId={shipId}
          onPickShip={() => undefined}
          drawMode={false}
        />

        <aside className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          {myShip ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">{myShip.name}</h2>
                <div className="text-xs text-slate-400">{myShip.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat k="Status" v={myShip.status} />
                <Stat k="Speed" v={`${myShip.speedKnots.toFixed(1)} kn`} />
              </div>
              <Stat k="Fuel" v={`${myShip.fuelTonnes.toFixed(1)} t remaining`} />
              <Stat
                k="Destination"
                v={`${myShip.destinationPortName} (${myShip.destinationPortId})`}
              />
            </>
          ) : (
            <p className="text-slate-500">Awaiting telemetry…</p>
          )}

          <div className="rounded-xl border border-amber-800/70 bg-amber-950/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-100">
              Orders from Command
            </div>
            {pending.length ? (
              <ul className="mt-2 space-y-3">
                {pending.map((d) => (
                  <li key={d.id} className="rounded-md border border-amber-800/80 bg-black/30 p-2">
                    <div className="text-xs text-amber-100/70">{d.kind}</div>
                    <pre className="mt-1 overflow-auto text-[11px] text-slate-200">
                      {JSON.stringify(d.payload, null, 2)}
                    </pre>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium hover:bg-emerald-600"
                        onClick={() =>
                          send({
                            type: "directive.respond",
                            directiveId: d.id,
                            response: "ACCEPT",
                          })
                        }
                      >
                        ACCEPT
                      </button>
                      <textarea
                        className="min-h-[72px] w-full rounded border border-red-900/60 bg-red-950/30 p-2 text-xs"
                        placeholder="Free-form distress / refusal context"
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-600"
                        onClick={() =>
                          send({
                            type: "directive.respond",
                            directiveId: d.id,
                            response: "ESCALATE_DISTRESS",
                            message: msg || "Captain escalating situation.",
                          })
                        }
                      >
                        ESCALATE_DISTRESS
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-amber-100/60">No pending directives.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-500">
            Restricted zones are view-only here. Alerts surface on the shared feed (Command /
            Playback).
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

export default function CaptainPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading…</div>}>
      <CaptainInner />
    </Suspense>
  );
}
