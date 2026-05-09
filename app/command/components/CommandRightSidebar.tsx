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
import type { Directive, FleetShipRuntime } from "@/lib/sim-types";
import { shipTypeVisual } from "./shipVisuals";

export function CommandRightSidebar({
  variant = "command",
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
  pendingDirectives,
  captainRespondMessage,
  onCaptainRespondMessageChange,
  onCaptainRespondDirective,
}: {
  variant?: "command" | "captain";
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
  pendingDirectives?: Directive[];
  captainRespondMessage?: string;
  onCaptainRespondMessageChange?: (value: string) => void;
  onCaptainRespondDirective?: (
    directiveId: string,
    response: "ACCEPT" | "ESCALATE_DISTRESS",
    message?: string,
  ) => void;
}) {
  return (
    <aside className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg shadow-slate-200/20 backdrop-blur-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <FontAwesomeIcon icon={faAnchor} className="text-sm" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                Vessel Intelligence
              </h2>
              <p className="text-[11px] text-slate-500">
                {variant === "captain" ? "Your ship — telemetry and orders" : "Tactical ship analytics and control"}
              </p>
            </div>
          </div>
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
              {selShip.routeMeta ? (
                <>
                  <ProfessionalRow
                    icon={faSatelliteDish}
                    label="Planned path"
                    value={`${selShip.routeMeta.pathNm.toFixed(1)} nm`}
                  />
                  <ProfessionalRow
                    icon={faCloud}
                    label="Adverse weather track"
                    value={`${selShip.routeMeta.insideAdverseNm.toFixed(1)} nm (30% extra burn)`}
                  />
                </>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-xl border-2 p-4 ${
              selShip.status === "insufficient_fuel"
                ? "border-rose-300 bg-rose-50"
                : "border-emerald-200 bg-emerald-50/80"
            }`}
          >
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <FontAwesomeIcon
                icon={faCircleCheck}
                className={`mr-2 ${selShip.status === "insufficient_fuel" ? "text-rose-600" : "text-emerald-600"}`}
              />
              Destination on current fuel
            </h4>
            <p className="text-sm leading-relaxed text-slate-800">
              {selShip.fuelRequiredRemainingTonnes == null ? (
                "No route projection available."
              ) : selShip.status === "arrived" ? (
                "Vessel has arrived."
              ) : selShip.status === "insufficient_fuel" ||
                selShip.fuelRequiredRemainingTonnes > selShip.fuelTonnes * 1.001 ? (
                <>
                  <strong className="text-rose-800">Likely not reachable</strong> on planned path with
                  Open-Meteo adverse segments (30% penalty): needs ~{" "}
                  <strong>{selShip.fuelRequiredRemainingTonnes.toFixed(1)} t</strong> vs{" "}
                  <strong>{selShip.fuelTonnes.toFixed(1)} t</strong> remaining.
                </>
              ) : (
                <>
                  <strong className="text-emerald-800">Reachable</strong>: projected need ~{" "}
                  {selShip.fuelRequiredRemainingTonnes.toFixed(1)} t (incl. weather penalty on adverse
                  legs) vs {selShip.fuelTonnes.toFixed(1)} t onboard
                  {selShip.fuelTonnes - selShip.fuelRequiredRemainingTonnes > 0.5
                    ? ` · margin ~${(selShip.fuelTonnes - selShip.fuelRequiredRemainingTonnes).toFixed(1)} t`
                    : ""}
                  .
                </>
              )}
            </p>
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

          {variant === "command" && (
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
          )}

          {variant === "captain" && (
            <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-900">
                <FontAwesomeIcon icon={faPaperPlane} className="mr-2 text-amber-600" />
                Orders from Command
              </h4>
              {(pendingDirectives?.length ?? 0) === 0 ? (
                <p className="text-sm text-amber-900/70">No pending orders.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingDirectives!.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-lg border border-amber-200 bg-white/80 p-3 shadow-sm"
                    >
                      <div className="text-xs font-semibold uppercase text-amber-800">{d.kind}</div>
                      <pre className="mt-1 max-h-24 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                        {JSON.stringify(d.payload, null, 2)}
                      </pre>
                      <div className="mt-2 flex flex-col gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                          onClick={() => onCaptainRespondDirective?.(d.id, "ACCEPT")}
                        >
                          ACCEPT
                        </button>
                        <textarea
                          className="min-h-[64px] w-full rounded-lg border border-rose-200 bg-rose-50/50 p-2 text-xs text-slate-800"
                          placeholder="Context for escalation (optional)"
                          value={captainRespondMessage ?? ""}
                          onChange={(e) => onCaptainRespondMessageChange?.(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                          onClick={() =>
                            onCaptainRespondDirective?.(
                              d.id,
                              "ESCALATE_DISTRESS",
                              captainRespondMessage || "Captain escalating situation.",
                            )
                          }
                        >
                          ESCALATE_DISTRESS
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
