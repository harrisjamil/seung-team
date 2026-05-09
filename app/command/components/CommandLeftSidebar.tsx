import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCheckCircle,
  faClock,
  faDrawPolygon,
  faExclamationTriangle,
  faMapPin,
  faShip,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import type { AlertRecord, FleetShipRuntime, RestrictedZone } from "@/lib/sim-types";
import { shipTypeVisual } from "./shipVisuals";

export function CommandLeftSidebar({
  ships,
  selectedId,
  drawMode,
  draftRing,
  currentZones,
  alerts,
  openAlertsCount,
  onSelectShip,
  onToggleDrawMode,
  onPublishZone,
  onClearDraftRing,
  onRequestDeleteZone,
  onAcknowledgeAlert,
}: {
  ships: FleetShipRuntime[];
  selectedId: string | null;
  drawMode: boolean;
  draftRing: [number, number][];
  currentZones: RestrictedZone[];
  alerts: AlertRecord[];
  openAlertsCount: number;
  onSelectShip: (id: string) => void;
  onToggleDrawMode: () => void;
  onPublishZone: () => void;
  onClearDraftRing: () => void;
  onRequestDeleteZone: (zone: { id: string; name: string }) => void;
  onAcknowledgeAlert: (alertId: string, resolved: boolean) => void;
}) {
  return (
    <aside className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg shadow-slate-200/20 backdrop-blur-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faShip} className="text-slate-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Fleet Roster
          </h2>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {ships.length} Vessels
          </span>
        </div>
      </div>

      <ul className="max-h-[320px] space-y-1 overflow-y-auto px-3 pb-3">
        {ships.map((s) => {
          const typeVisual = shipTypeVisual(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelectShip(s.id)}
                className={`group w-full rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200 ${
                  selectedId === s.id
                    ? "border-sky-500 bg-gradient-to-r from-sky-50 to-blue-50 shadow-md shadow-sky-100/50"
                    : s.status === "distressed"
                      ? "animate-pulse border-red-300 bg-gradient-to-r from-red-50 to-rose-50 hover:border-red-400"
                      : "border-transparent hover:border-slate-300 hover:bg-gradient-to-r hover:from-slate-50 hover:to-gray-50 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      s.status === "distressed"
                        ? "bg-red-100"
                        : selectedId === s.id
                          ? "bg-sky-100"
                          : "bg-slate-100 group-hover:bg-slate-200"
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={typeVisual.icon}
                      className={`text-sm ${
                        s.status === "distressed"
                          ? "text-red-500"
                          : selectedId === s.id
                            ? "text-sky-600"
                            : typeVisual.accentClass
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs font-medium capitalize text-slate-500">
                      {s.status} · {s.fuelTonnes.toFixed(0)}t fuel
                    </div>
                  </div>
                  {s.status === "distressed" && (
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="animate-pulse text-red-500"
                    />
                  )}
                  {selectedId === s.id && (
                    <FontAwesomeIcon icon={faCheckCircle} className="text-sky-500" />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mx-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faDrawPolygon} className="text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Restricted Zones
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleDrawMode}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              drawMode
                ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                : "border border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
            }`}
          >
            <FontAwesomeIcon icon={faDrawPolygon} />
            {drawMode ? "Drawing Active" : "Draw Zone"}
          </button>
        </div>
        {drawMode && (
          <div className="animate-fadeIn space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-amber-100/50 p-2 text-xs text-amber-700">
              <FontAwesomeIcon icon={faMapPin} className="text-amber-600" />
              <span>Click map to add vertices ({draftRing.length})</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onPublishZone}
                disabled={draftRing.length < 3}
              >
                Publish Zone
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
                onClick={onClearDraftRing}
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 border-t border-amber-200/70 pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Active Zones ({currentZones.length})
          </div>
          {currentZones.length === 0 ? (
            <p className="text-xs text-amber-700/80">No restricted zones created yet.</p>
          ) : (
            <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {currentZones.map((z) => (
                <li
                  key={z.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white/70 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{z.name}</p>
                    <p className="text-[10px] text-slate-500">{z.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRequestDeleteZone({ id: z.id, name: z.name })}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                    title="Delete restricted zone"
                  >
                    <FontAwesomeIcon icon={faTimesCircle} />
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mx-3 mb-3 rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faBell} className="text-red-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-800">
              Alerts Feed
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
            {openAlertsCount} Active
          </span>
        </div>
        <ul className="max-h-[280px] space-y-2 overflow-y-auto">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border-2 p-3 transition-all ${
                a.resolved
                  ? "border-slate-200 bg-white opacity-60"
                  : "border-red-300 bg-white shadow-md shadow-red-100/50"
              }`}
            >
              <div className="mb-1 flex items-start gap-2">
                <FontAwesomeIcon
                  icon={a.resolved ? faCheckCircle : faExclamationTriangle}
                  className={`mt-0.5 ${a.resolved ? "text-slate-400" : "text-red-500"}`}
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{a.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{a.detail}</div>
                </div>
              </div>
              {!a.resolved && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-50"
                    onClick={() => onAcknowledgeAlert(a.id, false)}
                    disabled={a.acknowledged}
                  >
                    <FontAwesomeIcon icon={faClock} className="mr-1" />
                    {a.acknowledged ? "Acknowledged" : "Acknowledge"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-200"
                    onClick={() => onAcknowledgeAlert(a.id, true)}
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                    Resolve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
