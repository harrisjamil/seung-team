import { FleetMap } from "@/components/FleetMap";
import type { FleetShipRuntime, RestrictedZone } from "@/lib/sim-types";

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
}: {
  bbox: { south: number; west: number; north: number; east: number } | null;
  ships: FleetShipRuntime[];
  zones: RestrictedZone[];
  selectedId: string | null;
  drawMode: boolean;
  draftRing: [number, number][];
  followSelected: boolean;
  onPickShip: (id: string) => void;
  onMapClick: (lng: number, lat: number) => void;
  onToggleFollow: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-lg shadow-slate-200/20">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Live Fleet Map
        </p>
        <button
          type="button"
          onClick={onToggleFollow}
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
            followSelected
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Follow selected: {followSelected ? "ON" : "OFF"}
        </button>
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
