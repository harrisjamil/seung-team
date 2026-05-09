"use client";

import type { FleetShipRuntime, HistorySnapshot, RestrictedZone } from "@/lib/sim-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClockRotateLeft, faCirclePlay } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo } from "react";

type FleetPlaybackBarProps = {
  connected: boolean;
  snapshots: HistorySnapshot[];
  requestPlayback: () => void;
  liveShipCount: number;
  /** `null` = show live positions from WebSocket; number = snapshot index */
  scrubIndex: number | null;
  onScrubIndexChange: (next: number | null) => void;
};

export function usePlaybackOverlay(
  snapshots: HistorySnapshot[],
  liveShips: FleetShipRuntime[],
  liveZones: RestrictedZone[],
  scrubIndex: number | null,
) {
  return useMemo(() => {
    if (scrubIndex == null || !snapshots.length) {
      return { ships: liveShips, zones: liveZones, snapshotTime: null as number | null };
    }
    const clamped = Math.max(0, Math.min(scrubIndex, snapshots.length - 1));
    const snap = snapshots[clamped];
    return {
      ships: snap.ships?.length ? snap.ships : liveShips,
      zones: snap.zones?.length ? snap.zones : liveZones,
      snapshotTime: snap.t,
    };
  }, [snapshots, liveShips, liveZones, scrubIndex]);
}

export function FleetPlaybackBar({
  connected,
  snapshots,
  requestPlayback,
  liveShipCount,
  scrubIndex,
  onScrubIndexChange,
}: FleetPlaybackBarProps) {
  const max = Math.max(0, snapshots.length - 1);
  const sliderVal = scrubIndex == null ? max : Math.min(scrubIndex, max);
  const liveMode = scrubIndex == null;

  useEffect(() => {
    if (!connected) return;
    const t = window.setTimeout(() => requestPlayback(), 500);
    return () => clearTimeout(t);
  }, [connected, requestPlayback]);

  const atLabel = useMemo(() => {
    if (!snapshots.length || scrubIndex == null) return "—";
    const s = snapshots[sliderVal];
    if (!s?.t) return "—";
    try {
      return new Date(s.t).toLocaleTimeString();
    } catch {
      return "—";
    }
  }, [snapshots, scrubIndex, sliderVal]);

  const onSlider = useCallback(
    (v: number) => {
      onScrubIndexChange(v);
    },
    [onScrubIndexChange],
  );

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FontAwesomeIcon icon={faClockRotateLeft} className="text-xs" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Fleet timeline
            </p>
            <p className="text-[11px] text-slate-500">
              Last ~1 h @ ~30 s · {snapshots.length} samples · {liveShipCount} vessels live
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => requestPlayback()}
          >
            Refresh history
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              liveMode
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => onScrubIndexChange(null)}
          >
            <FontAwesomeIcon icon={faCirclePlay} className="text-[10px]" />
            Live
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-600">
            {liveMode
              ? "Live positions (slider at latest snapshot)"
              : `Snapshot ${sliderVal + 1}/${snapshots.length} · ${atLabel}`}
          </span>
          <input
            type="range"
            min={0}
            max={max}
            value={snapshots.length ? sliderVal : 0}
            disabled={!snapshots.length}
            onChange={(e) => onSlider(Number(e.target.value))}
            className="w-full accent-sky-600 disabled:opacity-40"
          />
        </label>
      </div>
    </div>
  );
}
