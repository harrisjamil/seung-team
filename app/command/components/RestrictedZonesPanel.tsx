import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDrawPolygon,
  faMapPin,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import type { RestrictedZone } from "@/lib/sim-types";

export function RestrictedZonesPanel({
  drawMode,
  draftRing,
  currentZones,
  onToggleDrawMode,
  onPublishZone,
  onClearDraftRing,
  onRequestDeleteZone,
  zoneManagementEnabled = true,
}: {
  drawMode: boolean;
  draftRing: [number, number][];
  currentZones: RestrictedZone[];
  onToggleDrawMode: () => void;
  onPublishZone: () => void;
  onClearDraftRing: () => void;
  onRequestDeleteZone: (zone: { id: string; name: string }) => void;
  zoneManagementEnabled?: boolean;
}) {
  return (
    <section className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <FontAwesomeIcon icon={faDrawPolygon} className="text-sm" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Restricted zones
            </h2>
            <p className="text-xs text-slate-500">
              {zoneManagementEnabled
                ? "Draw operational boundaries on the map"
                : "Fleet restricted areas (read-only)"}
            </p>
          </div>
        </div>
        {zoneManagementEnabled ? (
          <button
            type="button"
            onClick={onToggleDrawMode}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
              drawMode
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <FontAwesomeIcon icon={faDrawPolygon} />
            {drawMode ? "Drawing…" : "Draw zone"}
          </button>
        ) : null}
      </div>

      {zoneManagementEnabled && drawMode ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <FontAwesomeIcon icon={faMapPin} className="text-sky-600" />
            <span>
              Click the map to add vertices — {draftRing.length} point
              {draftRing.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              onClick={onPublishZone}
              disabled={draftRing.length < 3}
            >
              Publish zone
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              onClick={onClearDraftRing}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Active zones
          </span>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
            {currentZones.length}
          </span>
        </div>
        {currentZones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No restricted zones yet.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {currentZones.map((z) => (
              <li
                key={z.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{z.name}</p>
                  <p className="truncate font-mono text-[11px] text-slate-500">{z.id}</p>
                </div>
                {zoneManagementEnabled ? (
                  <button
                    type="button"
                    onClick={() => onRequestDeleteZone({ id: z.id, name: z.name })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <FontAwesomeIcon icon={faTimesCircle} />
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
