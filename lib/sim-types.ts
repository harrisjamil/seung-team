import type { LatLng } from "./geo-client";

export type Role = "command" | "captain" | "spectator";

export interface FleetShipRuntime {
  id: string;
  name: string;
  position: LatLng;
  headingDeg: number;
  speedKnots: number;
  destinationPortId: string;
  destinationPortName: string;
  destinationPortPosition: LatLng;
  fuelTonnes: number;
  fuelBurnTonnesPerNm: number;
  cargo: Record<string, unknown>;
  status: string;
  route: LatLng[];
  pendingDirectiveId?: string;
  maxReportedSpeedKnots: number;
  weatherAdverse: boolean;
  fuelRequiredRemainingTonnes: number | null;
  routeMeta: { pathNm: number; insideAdverseNm: number } | null;
}

export interface RestrictedZone {
  id: string;
  name: string;
  ring: [number, number][];
  createdAt: number;
}

export interface AlertRecord {
  id: string;
  type: string;
  severityScore: number;
  title: string;
  detail: string;
  shipIds: string[];
  createdAt: number;
  acknowledged: boolean;
  resolved: boolean;
  directiveId?: string;
}

export interface Directive {
  id: string;
  shipId: string;
  kind: string;
  payload: Record<string, unknown>;
  issuedAt: number;
  acknowledgedByCaptainAt?: number;
  response?: "ACCEPT" | "ESCALATE_DISTRESS";
  distressMessageRaw?: string;
  distressStructured?: {
    severity: string;
    summary: string;
    category: string;
    injuries: number | null;
    damageEstimate: string | null;
  };
}

export interface SimStatePayload {
  t: number;
  tickSeconds: number;
  ships: FleetShipRuntime[];
  zones: RestrictedZone[];
  alerts: AlertRecord[];
  directives: Directive[];
}

export interface HistorySnapshot {
  t: number;
  ships: FleetShipRuntime[];
  alerts: AlertRecord[];
  zones: RestrictedZone[];
}
