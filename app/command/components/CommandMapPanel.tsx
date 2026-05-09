import { FleetMap } from "@/components/FleetMap";
import type { FleetShipRuntime, RestrictedZone } from "@/lib/sim-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapLocationDot, faSatellite, faTowerBroadcast } from "@fortawesome/free-solid-svg-icons";

export function CommandMapPanel({
  bbox,
  ships,
  zones,
  selectedId,
  drawMode,
  draftRing,
  followSelected,
  onPickShip,
  onMapClick,
  onToggleFollow,
  replayHint,
}: {
  bbox: { south: number; west: number; north: number; east: number } | null;
  ships: FleetShipRuntime[];
  zones: RestrictedZone[];
  selectedId: string | null;
  drawMode: boolean;
  draftRing: [number, number][];
  followSelected: boolean;
  onPickShip: (id: string | null) => void;
  onMapClick: (lng: number, lat: number) => void;
  onToggleFollow: () => void;
  replayHint?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3 sm:p-4 dark:border-slate-700 dark:from-slate-800/80 dark:to-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-sky-600">
              <FontAwesomeIcon icon={faMapLocationDot} className="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Live Fleet Map
              </p>
              <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                {replayHint ?? "Real-time vessel positioning & zone overlays"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleFollow}
            className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all sm:w-auto sm:py-1.5 ${
              followSelected
                ? "border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <FontAwesomeIcon icon={faSatellite} className={followSelected ? "animate-pulse" : ""} />
            <span className="whitespace-nowrap">Follow: {followSelected ? "ON" : "OFF"}</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <FontAwesomeIcon icon={faTowerBroadcast} className="text-slate-500 dark:text-slate-400" />
            {ships.length} vessels
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {zones.length} active zones
          </span>
          {drawMode && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              Drafting zone ({draftRing.length} points)
            </span>
          )}
        </div>
      </div>
      <FleetMap
        bbox={bbox}
        ships={ships}
        zones={zones}
        selectedId={selectedId}
        onPickShip={onPickShip}
        drawMode={drawMode}
        draftRing={draftRing}
        onMapClick={onMapClick}
        followSelected={followSelected}
      />
    </div>
  );
}
