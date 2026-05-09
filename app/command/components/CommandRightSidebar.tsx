import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnchor,
  faBoxes,
  faChartLine,
  faCircleCheck,
  faCloud,
  faCompass,
  faGasPump,
  faGauge,
  faLocationDot,
  faPaperPlane,
  faSatelliteDish,
  faShip,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { shipTypeVisual } from "./shipVisuals";

export function CommandRightSidebar({
  selShip,
  directiveKind,
  selectedPortId,
  wayLat,
  wayLng,
  ports,
  onDirectiveKindChange,
  onSelectedPortIdChange,
  onWayLatChange,
  onWayLngChange,
  onIssueDirective,
}: {
  selShip?: FleetShipRuntime;
  directiveKind: "reroute_port" | "divert_waypoint" | "hold_position";
  selectedPortId: string;
  wayLat: string;
  wayLng: string;
  ports: Record<string, { name: string; lat: number; lng: number }> | null;
  onDirectiveKindChange: (
    value: "reroute_port" | "divert_waypoint" | "hold_position",
  ) => void;
  onSelectedPortIdChange: (value: string) => void;
  onWayLatChange: (value: string) => void;
  onWayLngChange: (value: string) => void;
  onIssueDirective: () => void;
}) {
  return (
    <aside className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg shadow-slate-200/20 backdrop-blur-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faAnchor} className="text-slate-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Vessel Intelligence
          </h2>
        </div>
      </div>

      {selShip ? (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <ShipHeaderCard ship={selShip} />
          <div className="grid grid-cols-2 gap-2">
            <ProfessionalStatCard
              icon={faGauge}
              label="Speed"
              value={`${selShip.speedKnots.toFixed(1)} kn`}
              tone="sky"
            />
            <ProfessionalStatCard
              icon={faCompass}
              label="Heading"
              value={`${selShip.headingDeg.toFixed(0)}°`}
              tone="violet"
            />
            <ProfessionalStatCard
              icon={faGasPump}
              label="Fuel"
              value={`${selShip.fuelTonnes.toFixed(1)}t`}
              tone="amber"
            />
            <ProfessionalStatCard
              icon={faCloud}
              label="Weather"
              value={selShip.weatherAdverse ? "Adverse" : "Normal"}
              tone={selShip.weatherAdverse ? "rose" : "sky"}
            />
          </div>

          <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FontAwesomeIcon icon={faChartLine} className="mr-2 text-sky-500" />
              Operational Details
            </h4>
            <div className="space-y-2">
              <ProfessionalRow
                icon={faLocationDot}
                label="Destination"
                value={selShip.destinationPortName}
              />
              <ProfessionalRow
                icon={faGasPump}
                label="Fuel Burn Rate"
                value={`${selShip.fuelBurnTonnesPerNm}/nm`}
              />
              <ProfessionalRow
                icon={faChartLine}
                label="Fuel Projection"
                value={
                  selShip.fuelRequiredRemainingTonnes != null
                    ? `${selShip.fuelRequiredRemainingTonnes.toFixed(1)}t est.`
                    : "—"
                }
              />
            </div>
          </div>

          <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              <FontAwesomeIcon icon={faBoxes} className="mr-2 text-amber-500" />
              Cargo Manifest
            </h4>
            <pre className="max-h-[120px] overflow-auto rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 p-3 text-xs font-mono text-slate-700">
              {JSON.stringify(selShip.cargo, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-sky-800">
              <FontAwesomeIcon icon={faPaperPlane} className="mr-2 text-sky-600" />
              Issue Directive
            </h4>
            <div className="space-y-3">
              <select
                className="w-full rounded-lg border-2 border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={directiveKind}
                onChange={(e) =>
                  onDirectiveKindChange(
                    e.target.value as
                      | "reroute_port"
                      | "divert_waypoint"
                      | "hold_position",
                  )
                }
              >
                <option value="reroute_port">Reroute to Port</option>
                <option value="divert_waypoint">Divert to Waypoint</option>
                <option value="hold_position">Hold Position</option>
              </select>

              {directiveKind === "reroute_port" && (
                <select
                  className="w-full rounded-lg border-2 border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  value={selectedPortId}
                  onChange={(e) => onSelectedPortIdChange(e.target.value)}
                >
                  <option value="">Select destination port…</option>
                  {ports &&
                    Object.entries(ports).map(([pid, p]) => (
                      <option key={pid} value={pid}>
                        {p.name}
                      </option>
                    ))}
                </select>
              )}

              {directiveKind === "divert_waypoint" && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border-2 border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 placeholder-slate-400 transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="Latitude"
                    value={wayLat}
                    onChange={(e) => onWayLatChange(e.target.value)}
                  />
                  <input
                    className="rounded-lg border-2 border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 placeholder-slate-400 transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    placeholder="Longitude"
                    value={wayLng}
                    onChange={(e) => onWayLngChange(e.target.value)}
                  />
                </div>
              )}

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:from-sky-700 hover:to-blue-700"
                onClick={onIssueDirective}
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                Transmit Directive
              </button>
              <p className="text-center text-xs font-medium text-sky-700">
                Captain must accept or escalate distress within 30 seconds
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100">
              <FontAwesomeIcon icon={faShip} className="text-3xl text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-700">No Vessel Selected</h3>
            <p className="text-sm text-slate-500">
              Select a ship from the map or fleet roster to view details
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faSatelliteDish} className="text-emerald-500" />
          <span>WebSocket Telemetry · Open-Meteo Wind Data · NLP Optional</span>
        </div>
      </div>
    </aside>
  );
}

function ShipHeaderCard({ ship }: { ship: FleetShipRuntime }) {
  const typeVisual = shipTypeVisual(ship);
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 p-4 text-white shadow-lg">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
          <FontAwesomeIcon icon={typeVisual.icon} className="text-2xl text-sky-300" />
        </div>
        <div>
          <h3 className="text-xl font-bold">{ship.name}</h3>
          <p className="font-mono text-sm text-slate-300">{ship.id}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            ship.status === "distressed"
              ? "bg-red-500/20 text-red-200"
              : ship.status === "underway"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-sky-500/20 text-sky-200"
          }`}
        >
          <FontAwesomeIcon icon={faCircleCheck} className="text-xs" />
          {ship.status}
        </span>
      </div>
    </div>
  );
}

function ProfessionalStatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  tone: "sky" | "rose" | "amber" | "violet";
}) {
  const colors = {
    sky: "border-sky-200 bg-sky-50",
    rose: "border-rose-200 bg-rose-50",
    amber: "border-amber-200 bg-amber-50",
    violet: "border-violet-200 bg-violet-50",
  };
  const iconColors = {
    sky: "text-sky-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    violet: "text-violet-600",
  };
  return (
    <div className={`rounded-lg border-2 ${colors[tone]} p-3`}>
      <div className="mb-1 flex items-center gap-2">
        <FontAwesomeIcon icon={icon} className={`text-xs ${iconColors[tone]}`} />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ProfessionalRow({
  icon,
  label,
  value,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={icon} className="text-xs text-sky-500" />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <span className="text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
}
