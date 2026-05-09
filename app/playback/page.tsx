"use client";

import { FleetMap } from "@/components/FleetMap";
import { useFleetWs } from "@/lib/useFleetWs";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

export default function PlaybackPage() {
  const { connected, playback, requestPlayback, bbox, latest } = useFleetWs({
    role: "spectator",
  });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(() => requestPlayback(), 400);
    return () => clearTimeout(t);
  }, [connected, requestPlayback]);

  const snap = playback.length ? playback[Math.min(idx, playback.length - 1)] : null;

  const ships = useMemo(
    () =>
      snap?.ships?.length
        ? snap.ships
        : latest?.ships ?? [],
    [snap, latest],
  );

  const zones = snap?.zones?.length ? snap.zones : latest?.zones ?? [];

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-950 p-4 text-slate-100 lg:p-5">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Timeline playback</h1>
            <p className="text-sm text-slate-400">
              Last-hour history at coarse intervals · {connected ? "connected" : "connecting…"}
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
              onClick={() => requestPlayback()}
            >
              Refresh history
            </button>
            <Link href="/command" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800">
              Command
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <FleetMap
            bbox={bbox}
            ships={ships}
            zones={zones}
            selectedId={null}
            onPickShip={() => undefined}
          />
        </div>
        <aside className="w-full max-w-md space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-slate-500">Scrub timeline</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, playback.length - 1)}
              value={playback.length ? Math.min(idx, playback.length - 1) : 0}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="mt-2 w-full accent-sky-500"
              disabled={!playback.length}
            />
          </label>
          {snap ? (
            <div className="space-y-2 text-xs">
              <div className="text-slate-300">
                Snapshot {idx + 1} / {playback.length}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {new Date(snap.t).toLocaleString()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CardStat k="Ships" v={String(snap.ships.length)} />
                <CardStat k="Alerts" v={String(snap.alerts.length)} />
              </div>
              <div className="text-slate-500">
                Playback is a quick operational review timeline, not full deterministic replay.
              </div>
              <details className="rounded border border-slate-800 bg-slate-950 p-2">
                <summary className="cursor-pointer text-slate-400">Alerts at sample</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {snap.alerts.slice(0, 12).map((a) => (
                    <li key={a.id} className="text-[11px] text-slate-300">
                      {a.title}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : (
            <p className="text-slate-500">No snapshots yet — wait ~30s after simulator start.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function CardStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className="text-sm font-semibold text-slate-100">{v}</div>
    </div>
  );
}
