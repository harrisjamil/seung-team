export type Role = "command" | "captain" | "spectator";

export type ShipOperationalStatus =
  | "normal"
  | "rerouting"
  | "distressed"
  | "stopped"
  | "stranded"
  | "insufficient_fuel"
  | "arrived";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PortDefinition {
  name: string;
  lat: number;
  lng: number;
}

export interface FleetShipConfig {
  id: string;
  name: string;
  lat: number;
  lng: number;
  headingDeg: number;
  speedKnots: number;
  destinationPortId: string;
  fuelTonnes: number;
  fuelBurnTonnesPerNm: number;
  cargo: Record<string, unknown>;
}

export interface FleetJson {
  name: string;
  bbox: { south: number; west: number; north: number; east: number };
  navigableWater: GeoJSONPolygon;
  ports: Record<string, PortDefinition>;
  ships: FleetShipConfig[];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface RestrictedZone {
  id: string;
  name: string;
  /** GeoJSON-style ring [[lng,lat],...], closed ring */
  ring: [number, number][];
  createdAt: number;
}

export type DirectiveKind = "reroute_port" | "divert_waypoint" | "hold_position";

export interface Directive {
  id: string;
  shipId: string;
  kind: DirectiveKind;
  payload: Record<string, unknown>;
  issuedAt: number;
  acknowledgedByCaptainAt?: number;
  response?: "ACCEPT" | "ESCALATE_DISTRESS";
  distressMessageRaw?: string;
  distressStructured?: DistressStructured;
}

export interface DistressStructured {
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  category: string;
  injuries: number | null;
  damageEstimate: string | null;
}

export interface AlertRecord {
  id: string;
  type:
    | "geofence_breach"
    | "proximity"
    | "distress"
    | "stranded"
    | "fuel_low"
    | "fuel_exhausted"
    | "weather_danger"
    | "zone_encirclement_entry"
    | "zone_proximity"
    | "arrived";
  severityScore: number;
  title: string;
  detail: string;
  shipIds: string[];
  createdAt: number;
  acknowledged: boolean;
  resolved: boolean;
  /** Optional linkage for NLP distress */
  directiveId?: string;
}

/** Ring buffer playback sample */
export interface HistorySnapshot {
  t: number;
  ships: FleetShipRuntime[];
  alerts: AlertRecord[];
  zones: RestrictedZone[];
}

export interface ShipRouteMeta {
  pathNm: number;
  insideAdverseNm: number;
}

export interface FleetShipRuntime {
  id: string;
  name: string;
  position: LatLng;
  headingDeg: number;
  speedKnots: number;
  /** Nominal underway speed used when resuming from hold/reroute states */
  cruiseSpeedKnots: number;
  destinationPortId: string;
  destinationPortName: string;
  destinationPortPosition: LatLng;
  fuelTonnes: number;
  fuelBurnTonnesPerNm: number;
  cargo: Record<string, unknown>;
  status: ShipOperationalStatus;
  /** Waypoints excluding current segment target tail */
  route: LatLng[];
  pendingDirectiveId?: string;
  strandedReason?: string;
  /** Server-side smoothing / max speed knots for client interpolation clamp */
  maxReportedSpeedKnots: number;
  weatherAdverse: boolean;
  /** Rough estimate fuel required for remaining planned path accounting for weather multiplier */
  fuelRequiredRemainingTonnes: number | null;
  routeMeta: ShipRouteMeta | null;
}

export interface PlaybackBuffer {
  /** Monotonic timestamps, ~30s apart, last hour */
  snapshots: HistorySnapshot[];
  maxSnapshots: number;
}

export interface SimStatePayload {
  t: number;
  tickSeconds: number;
  ships: FleetShipRuntime[];
  zones: RestrictedZone[];
  alerts: AlertRecord[];
  directives: Directive[];
}
