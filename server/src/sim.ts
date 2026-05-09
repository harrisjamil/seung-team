import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bearingDegrees,
  distanceKmPointToRing,
  haversineKm,
  nmFromKm,
  pointInPolygon,
  pointInRingLngLat,
  normalizeHeading,
  segmentCrossesRestrictedRing,
} from "./geo.js";
import type {
  AlertRecord,
  Directive,
  FleetJson,
  FleetShipConfig,
  FleetShipRuntime,
  PlaybackBuffer,
  RestrictedZone,
  SimStatePayload,
  LatLng,
} from "./types.js";
import { parseDistressMessage, distressSeverityScore } from "./nlp.js";
import { computeRoute } from "./routing.js";
import {
  ADVERSE_FUEL_MULTIPLIER,
  fetchWeatherAt,
  isAdverseWeatherAt,
  measureAdverseAlongWaypoints,
  prefetchWeatherForRouting,
} from "./weather.js";
import { hasSupabase, safeDb, supabase } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESTRICTED_ZONES_TABLE = "restricted_zones";
const LEGACY_ZONES_TABLE = "zones";

type DbShipRow = {
  ship_id: string;
  name: string;
  lat: number;
  lng: number;
  speed_knots: number | null;
  heading_deg: number | null;
  destination_port_id: string | null;
  destination_port_name: string | null;
  fuel_tonnes: number | null;
  cargo: Record<string, unknown> | null;
  status: string | null;
  route: Array<{ lat?: number; lng?: number }> | null;
};

function loadFleetPath(): string {
  const fromEnv = process.env.FLEET_CONFIG;
  if (fromEnv) return fromEnv;
  return join(__dirname, "..", "..", "fleet.json");
}

function deepCloneFleetJson(raw: FleetJson): FleetJson {
  return structuredClone(raw);
}

/** Unique alert key for suppression */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export class SimEngine {
  fleet!: FleetJson;
  ships: FleetShipRuntime[] = [];
  zones: RestrictedZone[] = [];
  directives: Directive[] = [];
  alerts: AlertRecord[] = [];
  playback: PlaybackBuffer = { snapshots: [], maxSnapshots: 121 };
  proximityActive = new Set<string>();
  geofenceActive = new Set<string>();
  zoneNearActive = new Set<string>();
  weatherDangerActive = new Set<string>();
  t0 = Date.now();

  /** Invalidate stale async reroute when a newer one is requested for the same ship. */
  private routePlanGen = new Map<string, number>();

  readonly tickSeconds: number;

  constructor(tickSeconds = 1 / 4) {
    this.tickSeconds = tickSeconds;
    this.reloadFleet();
    this.snapshotPlaybackThrottled(Date.now(), true);
    setInterval(() => {
      void this.refreshWeatherForShips().catch(() => undefined);
    }, 7000).unref?.();
    void this.bootstrapFromSupabase();
    setInterval(() => {
      void this.syncShipsFromSupabase().catch(() => undefined);
    }, 10_000).unref?.();
  }

  private async bootstrapFromSupabase(): Promise<void> {
    const db = supabase;
    if (!hasSupabase || !db) return;
    await safeDb(async () => {
      let zonesData: Array<{
        zone_id: string;
        name: string;
        ring: [number, number][];
        created_at: number;
      }> | null = null;

      const restrictedZonesResult = await db
        .from(RESTRICTED_ZONES_TABLE)
        .select("zone_id,name,ring,created_at")
        .order("created_at", { ascending: true })
        .limit(100);
      if (restrictedZonesResult.error?.code === "42P01") {
        const legacyZonesResult = await db
          .from(LEGACY_ZONES_TABLE)
          .select("zone_id,name,ring,created_at")
          .order("created_at", { ascending: true })
          .limit(100);
        if (legacyZonesResult.error) throw legacyZonesResult.error;
        zonesData = legacyZonesResult.data;
      } else {
        if (restrictedZonesResult.error) throw restrictedZonesResult.error;
        zonesData = restrictedZonesResult.data;
      }

      if (zonesData?.length) {
        this.zones = zonesData.map((z) => ({
          id: String(z.zone_id),
          name: String(z.name),
          ring: z.ring as [number, number][],
          createdAt: Number(z.created_at ?? Date.now()),
        }));
      }
      await this.syncShipsFromSupabase();
      for (const s of this.ships) this.assignRouteFromPosition(s.id);
    });
  }

  private async syncShipsFromSupabase(): Promise<void> {
    const db = supabase;
    if (!hasSupabase || !db) return;
    await safeDb(async () => {
      const { data } = await db
        .from("ships")
        .select(
          "ship_id,name,lat,lng,speed_knots,heading_deg,destination_port_id,destination_port_name,fuel_tonnes,cargo,status,route",
        )
        .order("ship_id", { ascending: true })
        .limit(300);
      this.hydrateShipsFromDb((data ?? []) as DbShipRow[]);
    });
  }

  private hydrateShipsFromDb(rows: DbShipRow[]): void {
    for (const row of rows) {
      const id = String(row.ship_id ?? "").trim();
      if (!id || this.ships.some((s) => s.id === id)) continue;

      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const destinationPortId = String(row.destination_port_id ?? "").trim();
      const namedPort = destinationPortId ? this.fleet.ports[destinationPortId] : undefined;
      const routePts = Array.isArray(row.route)
        ? row.route
            .map((pt) => ({ lat: Number(pt?.lat), lng: Number(pt?.lng) }))
            .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
        : [];
      const fallbackDest = routePts.length > 0 ? routePts[routePts.length - 1] : { lat, lng };
      const destinationPortPosition = namedPort
        ? { lat: namedPort.lat, lng: namedPort.lng }
        : fallbackDest;

      const speedKnots = Math.max(0, Number(row.speed_knots ?? 12));
      const headingDeg = normalizeHeading(Number(row.heading_deg ?? 0));
      const fuelTonnes = Math.max(0, Number(row.fuel_tonnes ?? 300));
      const status = row.status === "arrived" ? "normal" : "normal";

      const ship: FleetShipRuntime = {
        id,
        name: String(row.name ?? id),
        position: { lat, lng },
        headingDeg,
        speedKnots,
        cruiseSpeedKnots: speedKnots > 0 ? speedKnots : 12,
        destinationPortId,
        destinationPortName:
          namedPort?.name ?? String(row.destination_port_name ?? "Command waypoint"),
        destinationPortPosition,
        fuelTonnes,
        fuelBurnTonnesPerNm: 0.045,
        cargo:
          row.cargo && typeof row.cargo === "object"
            ? (row.cargo as Record<string, unknown>)
            : {},
        status,
        route: [],
        maxReportedSpeedKnots: speedKnots,
        weatherAdverse: false,
        fuelRequiredRemainingTonnes: null,
        routeMeta: null,
      };

      if (!this.fleet.ships.some((x) => x.id === id)) {
        const portKey =
          destinationPortId && this.fleet.ports[destinationPortId]
            ? destinationPortId
            : Object.keys(this.fleet.ports)[0] ?? "jebel_ali";
        this.fleet.ships.push({
          id,
          name: ship.name,
          lat,
          lng,
          headingDeg,
          speedKnots,
          destinationPortId: portKey,
          fuelTonnes,
          fuelBurnTonnesPerNm: ship.fuelBurnTonnesPerNm,
          cargo: ship.cargo,
        });
      }

      this.ships.push(ship);
      this.assignRouteFromPosition(ship.id);
    }
  }

  reloadFleet(): void {
    const p = loadFleetPath();
    const txt = readFileSync(p, "utf-8");
    this.fleet = deepCloneFleetJson(JSON.parse(txt) as FleetJson);
    this.ships = this.fleet.ships.map((c) => this.configToRuntime(c));
    for (const s of this.ships) {
      this.assignRouteFromPosition(s.id);
    }
  }

  private persistFleetJson(): void {
    try {
      writeFileSync(loadFleetPath(), JSON.stringify(this.fleet, null, 2), "utf-8");
    } catch (e) {
      console.error("[sim] persistFleetJson failed", e);
    }
  }

  private async upsertShipToDb(s: FleetShipRuntime): Promise<void> {
    const db = supabase;
    if (!hasSupabase || !db) return;
    const now = Date.now();
    await safeDb(async () => {
      await db.from("ships").upsert(
        {
          ship_id: s.id,
          name: s.name,
          lat: s.position.lat,
          lng: s.position.lng,
          speed_knots: s.speedKnots,
          heading_deg: s.headingDeg,
          destination_port_id: s.destinationPortId,
          destination_port_name: s.destinationPortName,
          fuel_tonnes: s.fuelTonnes,
          cargo: s.cargo,
          status: s.status,
          weather_adverse: s.weatherAdverse,
          fuel_required_remaining_tonnes: s.fuelRequiredRemainingTonnes,
          route: s.route,
          route_meta: s.routeMeta,
          updated_at: now,
        },
        { onConflict: "ship_id" },
      );
    });
  }

  private async deleteShipFromDb(shipId: string): Promise<void> {
    const db = supabase;
    if (!hasSupabase || !db) return;
    await safeDb(async () => {
      await db.from("ships").delete().eq("ship_id", shipId);
    });
  }

  /** Command: add a vessel from config (updates {@link fleet.json} when possible). */
  createShip(cfg: FleetShipConfig): { ok: true } | { ok: false; error: string } {
    if (this.ships.some((s) => s.id === cfg.id)) {
      return { ok: false, error: "A ship with this id already exists." };
    }
    if (!this.fleet.ports[cfg.destinationPortId]) {
      return { ok: false, error: "Unknown destination port." };
    }
    if (!pointInPolygon(this.fleet.navigableWater, cfg.lng, cfg.lat)) {
      return { ok: false, error: "Start position is outside navigable water." };
    }
    const full: FleetShipConfig = {
      ...cfg,
      cargo: (cfg.cargo && typeof cfg.cargo === "object" ? cfg.cargo : {}) as Record<string, unknown>,
    };
    this.fleet.ships.push(full);
    const runtime = this.configToRuntime(full);
    this.ships.push(runtime);
    this.assignRouteFromPosition(cfg.id);
    this.persistFleetJson();
    void this.upsertShipToDb(runtime);
    return { ok: true };
  }

  /** Command: edit static config fields and sync runtime + DB. */
  updateShip(
    shipId: string,
    patch: Partial<Omit<FleetShipConfig, "id">>,
  ): { ok: true } | { ok: false; error: string } {
    const fi = this.fleet.ships.findIndex((s) => s.id === shipId);
    const runtime = this.ships.find((s) => s.id === shipId);
    if (fi < 0 || !runtime) {
      return { ok: false, error: "Ship not found." };
    }
    const cur = this.fleet.ships[fi];
    const nextPortId =
      patch.destinationPortId !== undefined ? patch.destinationPortId : cur.destinationPortId;
    if (!this.fleet.ports[nextPortId]) {
      return { ok: false, error: "Unknown destination port." };
    }
    const lat = patch.lat !== undefined ? Number(patch.lat) : cur.lat;
    const lng = patch.lng !== undefined ? Number(patch.lng) : cur.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: "Invalid coordinates." };
    }
    if (!pointInPolygon(this.fleet.navigableWater, lng, lat)) {
      return { ok: false, error: "Position is outside navigable water." };
    }

    const merged: FleetShipConfig = {
      ...cur,
      id: shipId,
      name: patch.name !== undefined ? String(patch.name) : cur.name,
      lat,
      lng,
      headingDeg:
        patch.headingDeg !== undefined ? normalizeHeading(Number(patch.headingDeg)) : cur.headingDeg,
      speedKnots: patch.speedKnots !== undefined ? Number(patch.speedKnots) : cur.speedKnots,
      destinationPortId: nextPortId,
      fuelTonnes: patch.fuelTonnes !== undefined ? Number(patch.fuelTonnes) : cur.fuelTonnes,
      fuelBurnTonnesPerNm:
        patch.fuelBurnTonnesPerNm !== undefined
          ? Number(patch.fuelBurnTonnesPerNm)
          : cur.fuelBurnTonnesPerNm,
      cargo:
        patch.cargo !== undefined && typeof patch.cargo === "object"
          ? (patch.cargo as Record<string, unknown>)
          : cur.cargo,
    };

    this.fleet.ships[fi] = merged;

    const dest = this.fleet.ports[merged.destinationPortId];
    const portName = dest?.name ?? merged.destinationPortId;
    const destPos =
      dest != null ? { lat: dest.lat, lng: dest.lng } : { lat: merged.lat, lng: merged.lng };

    runtime.name = merged.name;
    runtime.position = { lat: merged.lat, lng: merged.lng };
    runtime.headingDeg = normalizeHeading(merged.headingDeg);
    runtime.speedKnots = merged.speedKnots;
    runtime.cruiseSpeedKnots = merged.speedKnots;
    runtime.destinationPortId = merged.destinationPortId;
    runtime.destinationPortName = portName;
    runtime.destinationPortPosition = destPos;
    runtime.fuelTonnes = merged.fuelTonnes;
    runtime.fuelBurnTonnesPerNm = merged.fuelBurnTonnesPerNm;
    runtime.cargo = merged.cargo as Record<string, unknown>;
    runtime.maxReportedSpeedKnots = Math.max(runtime.maxReportedSpeedKnots, merged.speedKnots);

    this.assignRouteFromPosition(shipId);
    this.persistFleetJson();
    void this.upsertShipToDb(runtime);
    return { ok: true };
  }

  /** Command: remove from sim, fleet file, and database. */
  deleteShip(shipId: string): { ok: true } | { ok: false; error: string } {
    const before = this.ships.length;
    this.fleet.ships = this.fleet.ships.filter((s) => s.id !== shipId);
    this.ships = this.ships.filter((s) => s.id !== shipId);
    if (this.ships.length === before) {
      return { ok: false, error: "Ship not found." };
    }
    this.directives = this.directives.filter((d) => d.shipId !== shipId);
    for (const k of [...this.proximityActive]) {
      if (k.includes(shipId)) this.proximityActive.delete(k);
    }
    for (const k of [...this.geofenceActive]) {
      if (k.startsWith(`${shipId}:`)) this.geofenceActive.delete(k);
    }
    for (const k of [...this.zoneNearActive]) {
      if (k.startsWith(`${shipId}:`)) this.zoneNearActive.delete(k);
    }
    this.weatherDangerActive.delete(shipId);
    this.persistFleetJson();
    void this.deleteShipFromDb(shipId);
    return { ok: true };
  }

  private configToRuntime(cfg: FleetJson["ships"][0]): FleetShipRuntime {
    const dest = this.fleet.ports[cfg.destinationPortId];
    const portName = dest?.name ?? cfg.destinationPortId;
    const destPos =
      dest != null ? { lat: dest.lat, lng: dest.lng } : { lat: cfg.lat, lng: cfg.lng };
    return {
      id: cfg.id,
      name: cfg.name,
      position: { lat: cfg.lat, lng: cfg.lng },
      headingDeg: normalizeHeading(cfg.headingDeg),
      speedKnots: cfg.speedKnots,
      cruiseSpeedKnots: cfg.speedKnots,
      destinationPortId: cfg.destinationPortId,
      destinationPortName: portName,
      destinationPortPosition: destPos,
      fuelTonnes: cfg.fuelTonnes,
      fuelBurnTonnesPerNm: cfg.fuelBurnTonnesPerNm,
      cargo: cfg.cargo as Record<string, unknown>,
      status: "normal",
      route: [],
      maxReportedSpeedKnots: cfg.speedKnots,
      weatherAdverse: false,
      fuelRequiredRemainingTonnes: null,
      routeMeta: null,
    };
  }

  assignRouteFromPosition(shipId: string): void {
    const next = (this.routePlanGen.get(shipId) ?? 0) + 1;
    this.routePlanGen.set(shipId, next);
    void this.assignRouteFromPositionAsync(shipId, next);
  }

  private async assignRouteFromPositionAsync(shipId: string, gen: number): Promise<void> {
    const s = this.ships.find((x) => x.id === shipId);
    if (!s) return;
    if (s.status === "stopped") {
      return;
    }

    /** Hold / arrived vessels do not auto-navigate unless status changes externally */
    if (s.status === "arrived") {
      return;
    }

    try {
      await prefetchWeatherForRouting(s.position, s.destinationPortPosition);
    } catch {
      /* routing still runs with cold cache */
    }
    if (this.routePlanGen.get(shipId) !== gen) return;

    const prevStatus = s.status;
    if (s.speedKnots <= 0 && s.fuelTonnes > 0) {
      s.speedKnots = Math.max(s.cruiseSpeedKnots, 1);
    }
    const r = computeRoute(this.fleet, this.zones, s.position, s.destinationPortPosition, 0.03);
    if (this.routePlanGen.get(shipId) !== gen) return;

    if (r.unreachable || r.waypoints.length < 2) {
      s.status = "stranded";
      s.route = [];
      s.routeMeta = null;
      s.strandedReason =
        "No valid path avoids restricted zones and stays in navigable water.";
      if (prevStatus !== "stranded") {
        this.raiseAlert({
          type: "stranded",
          severityScore: 95,
          title: `Ship stranded: ${s.name}`,
          detail: s.strandedReason ?? "No feasible route.",
          shipIds: [s.id],
        });
      }
      this.updateFuelProjection(s);
      return;
    }

    const adverseMetrics = measureAdverseAlongWaypoints(r.waypoints);
    s.route = r.waypoints.length > 1 ? r.waypoints.slice(1) : [];
    s.routeMeta = {
      pathNm: adverseMetrics.pathNm,
      insideAdverseNm: adverseMetrics.insideAdverseNm,
    };
    this.updateHeadingTowardWaypoint(s);

    const preserve =
      prevStatus === "distressed" || prevStatus === "insufficient_fuel";
    if (!preserve) {
      s.status = "normal";
    }
    this.updateFuelProjection(s);
  }

  /** Remaining trip fuel (tonnes) from current position along planned route; per-segment 30% penalty if midpoint is adverse in cache. */
  private fuelRequiredAlongRemainingPath(s: FleetShipRuntime): number {
    const chain: LatLng[] = [s.position, ...s.route, s.destinationPortPosition];
    if (chain.length < 2) return 0;
    let acc = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      const nm = nmFromKm(haversineKm(chain[i], chain[i + 1]));
      const midLat = (chain[i].lat + chain[i + 1].lat) / 2;
      const midLng = (chain[i].lng + chain[i + 1].lng) / 2;
      const mult = isAdverseWeatherAt(midLat, midLng) ? ADVERSE_FUEL_MULTIPLIER : 1;
      acc += nm * s.fuelBurnTonnesPerNm * mult;
    }
    return acc;
  }

  private updateFuelProjection(s: FleetShipRuntime): void {
    if (s.status === "arrived") {
      s.fuelRequiredRemainingTonnes = 0;
      return;
    }
    if (
      !s.route.length &&
      haversineKm(s.position, s.destinationPortPosition) < 0.85
    ) {
      s.fuelRequiredRemainingTonnes =
        nmFromKm(haversineKm(s.position, s.destinationPortPosition)) *
        s.fuelBurnTonnesPerNm *
        (s.weatherAdverse ? ADVERSE_FUEL_MULTIPLIER : 1);
    } else {
      s.fuelRequiredRemainingTonnes = this.fuelRequiredAlongRemainingPath(s);
    }
    if (
      typeof s.fuelRequiredRemainingTonnes === "number" &&
      s.fuelRequiredRemainingTonnes > s.fuelTonnes * 1.001
    ) {
      if (s.status !== "insufficient_fuel") {
        const short =
          s.fuelRequiredRemainingTonnes - s.fuelTonnes;
        this.raiseAlert({
          type: "fuel_low",
          severityScore: 75,
          title: `Insufficient fuel projection: ${s.name}`,
          detail: `Need ~${s.fuelRequiredRemainingTonnes.toFixed(1)} t for remaining path (incl. up to ${Math.round((ADVERSE_FUEL_MULTIPLIER - 1) * 100)}% weather penalty on adverse legs); onboard ${s.fuelTonnes.toFixed(1)} t (short ~${short.toFixed(1)} t).`,
          shipIds: [s.id],
        });
      }
      s.status = "insufficient_fuel";
    }
  }

  updateHeadingTowardWaypoint(s: FleetShipRuntime): void {
    const target =
      s.route.length > 0 ? s.route[0] : s.destinationPortPosition;
    s.headingDeg = normalizeHeading(bearingDegrees(s.position, target));
    s.maxReportedSpeedKnots = Math.max(s.maxReportedSpeedKnots, s.speedKnots);
  }

  private refreshWeatherCounter = 0;

  /** Stagger inexpensive weather lookups for each ship (~15 calls per cycle but cached). */
  async refreshWeatherForShips(): Promise<void> {
    const batch = Math.min(this.ships.length, 15);
    for (let i = 0; i < batch; i++) {
      const idx = (this.refreshWeatherCounter + i) % this.ships.length;
      const snap = await fetchWeatherAt(
        this.ships[idx].position.lat,
        this.ships[idx].position.lng,
      );
      this.ships[idx].weatherAdverse = snap.adverse;
      const sid = this.ships[idx].id;
      if (snap.adverse) {
        if (!this.weatherDangerActive.has(sid)) {
          this.weatherDangerActive.add(sid);
          this.raiseAlert({
            type: "weather_danger",
            severityScore: 68,
            title: `Adverse weather: ${this.ships[idx].name}`,
            detail: `Wind ${snap.windMps.toFixed(1)} m/s gust ${snap.gustMps.toFixed(1)} m/s`,
            shipIds: [sid],
          });
        }
      } else {
        this.weatherDangerActive.delete(sid);
      }
    }
    this.refreshWeatherCounter = (this.refreshWeatherCounter + 1) % 9999;
    for (const s of this.ships) this.updateFuelProjection(s);
  }

  step(now: number): SimStatePayload {
    const Δ = this.tickSeconds;
    /** Movement */
    for (const s of this.ships) {
      const prevPos = { ...s.position };

      if (s.status === "stopped" || s.status === "arrived" || s.status === "stranded") {
        continue;
      }
      if (
        s.route.length === 0 &&
        haversineKm(s.position, s.destinationPortPosition) > 0.15 &&
        s.fuelTonnes > 0
      ) {
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      }

      /** nm this tick */
      const nmMoved = (s.speedKnots / 3600) * Δ;
      const nmToNext =
        s.route.length > 0
          ? nmFromKm(haversineKm(s.position, s.route[0]))
          : nmFromKm(haversineKm(s.position, s.destinationPortPosition));

      if (nmMoved >= nmToNext) {
        if (s.route.length > 0) {
          const wp = s.route.shift()!;
          s.position.lat = wp.lat;
          s.position.lng = wp.lng;
          if (
            s.route.length === 0 &&
            haversineKm(s.position, s.destinationPortPosition) <= 0.12
          ) {
            s.position.lat = s.destinationPortPosition.lat;
            s.position.lng = s.destinationPortPosition.lng;
            s.speedKnots = 0;
            s.status = "arrived";
            this.raiseArrival(s);
            continue;
          }
        } else if (nmToNext <= 2 * nmMoved) {
          s.position.lat = s.destinationPortPosition.lat;
          s.position.lng = s.destinationPortPosition.lng;
          s.speedKnots = 0;
          s.status = "arrived";
          this.raiseArrival(s);
          continue;
        }
        /** overshoot fractional carry */
        let remainNm = nmMoved - nmToNext;
        /** Simple iteration cap */
        for (let k = 0; k < 8 && remainNm > 1e-6; k++) {
          const nextTarget =
            s.route.length > 0 ? s.route[0] : s.destinationPortPosition;
          const d = nmFromKm(haversineKm(s.position, nextTarget));
          if (d < 1e-6) break;
          if (remainNm >= d - 1e-6) {
            s.position.lat = nextTarget.lat;
            s.position.lng = nextTarget.lng;
            remainNm -= d;
            if (s.route.length > 0) s.route.shift();
            else {
              s.status = "arrived";
              s.speedKnots = 0;
              remainNm = 0;
              this.raiseArrival(s);
              break;
            }
          } else {
            /** partial move */
            const t = remainNm / d;
            s.position.lat += (nextTarget.lat - s.position.lat) * t;
            s.position.lng += (nextTarget.lng - s.position.lng) * t;
            remainNm = 0;
          }
        }
        this.updateHeadingTowardWaypoint(s);
      } else {
        const target =
          s.route.length > 0 ? s.route[0] : s.destinationPortPosition;
        const t = nmMoved / Math.max(nmToNext, 1e-9);
        s.position.lat += (target.lat - s.position.lat) * t;
        s.position.lng += (target.lng - s.position.lng) * t;
        this.updateHeadingTowardWaypoint(s);
      }

      if (
        !pointInPolygon(
          this.fleet.navigableWater,
          s.position.lng,
          s.position.lat,
        ) &&
        s.status !== "arrived"
      ) {
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      }

      const burnNm = nmFromKm(haversineKm(prevPos, s.position));
      const factor = s.weatherAdverse ? ADVERSE_FUEL_MULTIPLIER : 1;
      s.fuelTonnes -= burnNm * s.fuelBurnTonnesPerNm * factor;
      if (s.fuelTonnes <= 0) {
        s.fuelTonnes = 0;
        s.speedKnots = 0;
        s.status = "stopped";
        this.raiseAlert({
          type: "fuel_exhausted",
          severityScore: 92,
          title: `Out of fuel: ${s.name}`,
          detail: "Propulsion halted until refuel / assistance.",

          shipIds: [s.id],
        });
      }

      /** Geofence breach */
      for (const z of this.zones) {
        if (pointInRingLngLat(z.ring, s.position.lng, s.position.lat)) {
          const gid = `${s.id}:${z.id}`;
          if (!this.geofenceActive.has(gid)) {
            this.geofenceActive.add(gid);
            this.raiseAlert({
              type: "geofence_breach",
              severityScore: 88,
              title: `Restricted zone breach: ${s.name}`,
              detail: `Inside zone "${z.name}".`,
              shipIds: [s.id],
            });
            void z;
          }
          s.status = s.status === "distressed" ? "distressed" : "rerouting";
          /** Attempt escape reroute immediately */
          this.assignRouteFromPosition(s.id);
        } else if (segmentCrossesRestrictedRing(prevPos, s.position, z.ring)) {
          const gid = `${s.id}:${z.id}`;
          if (!this.geofenceActive.has(gid)) {
            this.geofenceActive.add(gid);
            this.raiseAlert({
              type: "zone_encirclement_entry",
              severityScore: 90,
              title: `Entered restricted air/water (${z.name})`,
              detail: `${s.name} crossed boundary.`,
              shipIds: [s.id],
            });
          }
          s.status = "rerouting";
          this.assignRouteFromPosition(s.id);
        }
      }

      /** Outside zone but within ~2 km of boundary (warning, with hysteresis) */
      for (const z of this.zones) {
        const nearKey = `${s.id}:${z.id}:near`;
        if (pointInRingLngLat(z.ring, s.position.lng, s.position.lat)) {
          this.zoneNearActive.delete(nearKey);
          continue;
        }
        const d = distanceKmPointToRing(s.position.lng, s.position.lat, z.ring);
        if (d <= 2.0 && Number.isFinite(d)) {
          if (!this.zoneNearActive.has(nearKey)) {
            this.zoneNearActive.add(nearKey);
            this.raiseAlert({
              type: "zone_proximity",
              severityScore: 70,
              title: `Near restricted zone: ${s.name}`,
              detail: `Within 2 km of "${z.name}" (~${d.toFixed(1)} km to boundary) — maintain clearance.`,
              shipIds: [s.id],
            });
          }
        } else if (d > 2.5) {
          this.zoneNearActive.delete(nearKey);
        }
      }

      /** Path intersection with zones */
      for (let i = 0; i < s.route.length - 1; i++) {
        const a = s.route[i];
        const b = s.route[i + 1];
        for (const z of this.zones) {
          if (segmentCrossesRestrictedRing({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, z.ring)) {
            s.status = "rerouting";
            this.assignRouteFromPosition(s.id);
            break;
          }
        }
      }

      this.updateFuelProjection(s);
    }

    /** Proximity warnings */
    for (let i = 0; i < this.ships.length; i++) {
      for (let j = i + 1; j < this.ships.length; j++) {
        const a = this.ships[i];
        const b = this.ships[j];
        const d = haversineKm(a.position, b.position);
        const pk = pairKey(a.id, b.id);
        if (d < 2) {
          if (!this.proximityActive.has(pk)) {
            this.proximityActive.add(pk);
            this.raiseAlert({
              type: "proximity",
              severityScore: 72,
              title: "Proximity warning (≤2 km)",
              detail: `${a.name} and ${b.name} are within 2 km — separation recommended.`,
              shipIds: [a.id, b.id],
            });
          }
        } else {
          this.proximityActive.delete(pk);
        }
      }
    }

    this.snapshotPlaybackThrottled(now, false);
    void this.persistTick(now);

    return {
      t: now,
      tickSeconds: this.tickSeconds,
      ships: this.ships.map((x) => structuredClone(x)),
      zones: this.zones.map((z) => structuredClone(z)),
      alerts: this.alerts.map((a) => structuredClone(a)),
      directives: this.directives.map((d) => structuredClone(d)),
    };
  }

  private lastPlaybackAt = 0;

  private snapshotPlaybackThrottled(now: number, force: boolean): void {
    if (!force && now - this.lastPlaybackAt < 29_000) return;
    this.lastPlaybackAt = now;
    this.playback.snapshots.push({
      t: now,
      ships: this.ships.map((s) => structuredClone(s)),
      alerts: this.alerts.map((a) => structuredClone(a)),
      zones: this.zones.map((z) => structuredClone(z)),
    });
    if (this.playback.snapshots.length > this.playback.maxSnapshots) {
      this.playback.snapshots.splice(
        0,
        this.playback.snapshots.length - this.playback.maxSnapshots,
      );
    }
  }

  private async persistTick(now: number): Promise<void> {
    const db = supabase;
    if (!hasSupabase || !db) return;
    const ships = this.ships.map((s) => ({
      ship_id: s.id,
      name: s.name,
      lat: s.position.lat,
      lng: s.position.lng,
      speed_knots: s.speedKnots,
      heading_deg: s.headingDeg,
      destination_port_id: s.destinationPortId,
      destination_port_name: s.destinationPortName,
      fuel_tonnes: s.fuelTonnes,
      cargo: s.cargo,
      status: s.status,
      weather_adverse: s.weatherAdverse,
      fuel_required_remaining_tonnes: s.fuelRequiredRemainingTonnes,
      route: s.route,
      route_meta: s.routeMeta,
      updated_at: now,
    }));
    await safeDb(async () => {
      await db.from("ships").upsert(ships, { onConflict: "ship_id" });
    });

    if (now - this.lastPlaybackAt < 2_000) {
      await safeDb(async () => {
        const snap = this.playback.snapshots[this.playback.snapshots.length - 1];
        if (!snap) return;
        await db.from("ship_history").insert({
          t: snap.t,
          ships: snap.ships,
          alerts: snap.alerts,
          zones: snap.zones,
        });
      });
    }
  }

  private raiseArrival(s: FleetShipRuntime): void {
    this.raiseAlert({
      type: "arrived",
      severityScore: 12,
      title: `Ship arrived: ${s.name}`,
      detail: `Arrived at ${s.destinationPortName}.`,
      shipIds: [s.id],
    });
  }

  private raiseAlert(a: Omit<AlertRecord, "id" | "createdAt" | "acknowledged" | "resolved">): void {
    const rec: AlertRecord = {
      ...a,
      id: `al-${nowString()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      acknowledged: false,
      resolved: false,
    };
    this.alerts.unshift(rec);
    if (this.alerts.length > 200) this.alerts.pop();
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        await db.from("alerts").insert({
          alert_id: rec.id,
          type: rec.type,
          severity_score: rec.severityScore,
          title: rec.title,
          detail: rec.detail,
          ship_ids: rec.shipIds,
          created_at: rec.createdAt,
          acknowledged: rec.acknowledged,
          resolved: rec.resolved,
          directive_id: rec.directiveId ?? null,
        });
      });
    }
  }

  addZone(z: Omit<RestrictedZone, "createdAt">): void {
    const zone: RestrictedZone = { ...z, createdAt: Date.now() };
    this.zones.push(zone);
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        const { error } = await db.from(RESTRICTED_ZONES_TABLE).upsert({
          zone_id: zone.id,
          name: zone.name,
          ring: zone.ring,
          created_at: zone.createdAt,
        });
        if (error) throw error;
      });
    }
    /** Ships already inside */
    for (const s of this.ships) {
      if (pointInRingLngLat(zone.ring, s.position.lng, s.position.lat)) {
        this.raiseAlert({
          type: "geofence_breach",
          severityScore: 92,
          title: `Ship inside newly drawn zone`,
          detail: `${s.name} is inside "${zone.name}".`,
          shipIds: [s.id],
        });
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      }
    }
    /** Any path crossing new zone */
    for (const s of this.ships) {
      if (this.pathCrossesZone(s, zone)) {
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      }
    }
  }

  updateZone(id: string, ring: [number, number][], name?: string): void {
    const z = this.zones.find((x) => x.id === id);
    if (!z) return;
    z.ring = ring;
    if (name != null) z.name = name;
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        const { error } = await db.from(RESTRICTED_ZONES_TABLE).upsert({
          zone_id: z.id,
          name: z.name,
          ring: z.ring,
          created_at: z.createdAt,
        });
        if (error) throw error;
      });
    }
    for (const s of this.ships) {
      if (pointInRingLngLat(z.ring, s.position.lng, s.position.lat)) {
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      } else if (this.pathCrossesZone(s, z)) {
        s.status = "rerouting";
        this.assignRouteFromPosition(s.id);
      }
    }
  }

  deleteZone(id: string): void {
    this.zones = this.zones.filter((z) => z.id !== id);
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        const { error } = await db.from(RESTRICTED_ZONES_TABLE).delete().eq("zone_id", id);
        if (error) throw error;
      });
    }
    for (const s of this.ships) this.assignRouteFromPosition(s.id);
  }

  private pathCrossesZone(s: FleetShipRuntime, z: RestrictedZone): boolean {
    const chain: LatLng[] = [s.position, ...s.route, s.destinationPortPosition];
    for (let i = 0; i < chain.length - 1; i++) {
      if (segmentCrossesRestrictedRing(chain[i], chain[i + 1], z.ring)) return true;
    }
    return false;
  }

  issueDirective(
    d: Omit<Directive, "id" | "issuedAt">,
  ): Directive {
    const full: Directive = {
      ...d,
      id: `dir-${Math.random().toString(36).slice(2, 10)}`,
      issuedAt: Date.now(),
    };
    this.directives.unshift(full);
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        await db.from("directives").insert({
          directive_id: full.id,
          ship_id: full.shipId,
          kind: full.kind,
          payload: full.payload,
          issued_at: full.issuedAt,
        });
      });
    }

    const s = this.ships.find((x) => x.id === d.shipId);
    if (s) s.pendingDirectiveId = full.id;
    if (this.directives.length > 100) this.directives.pop();
    return full;
  }

  async respondDirective(
    id: string,
    response: "ACCEPT" | "ESCALATE_DISTRESS",
    message?: string,
  ): Promise<void> {
    const d = this.directives.find((x) => x.id === id);
    if (!d) return;
    d.response = response;
    d.acknowledgedByCaptainAt = Date.now();
    if (hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        await db
          .from("directives")
          .update({
            response: d.response,
            acknowledged_by_captain_at: d.acknowledgedByCaptainAt,
          })
          .eq("directive_id", d.id);
      });
    }
    if (response === "ESCALATE_DISTRESS") {
      d.distressMessageRaw = message ?? "";
      d.distressStructured = await parseDistressMessage(d.distressMessageRaw);
      const score = distressSeverityScore(d.distressStructured);
      this.raiseAlert({
        type: "distress",
        severityScore: score,
        title: `Distress escalated: ${d.shipId}`,
        detail: d.distressStructured.summary,
        shipIds: [d.shipId],
        directiveId: d.id,
      });
      if (hasSupabase && supabase) {
        const db = supabase;
        void safeDb(async () => {
          await db.from("distress_logs").insert({
            directive_id: d.id,
            ship_id: d.shipId,
            raw_message: d.distressMessageRaw ?? "",
            structured: d.distressStructured,
            severity_score: score,
            created_at: Date.now(),
          });
        });
      }
      const ship = this.ships.find((s) => s.id === d.shipId);
      if (ship) {
        ship.status = "distressed";
        ship.pendingDirectiveId = undefined;
      }
      return;
    }

    /** ACCEPT */
    const ship = this.ships.find((s) => s.id === d.shipId);
    if (!ship) return;
    ship.pendingDirectiveId = undefined;
    if (ship.status === "distressed") ship.status = "normal";
    if (d.kind === "hold_position") {
      ship.status = "stopped";
      ship.route = [];
      ship.speedKnots = 0;
      return;
    }
    if (d.kind === "reroute_port") {
      const pid = String(d.payload.portId ?? "");
      const p = this.fleet.ports[pid];
      if (p) {
        ship.destinationPortId = pid;
        ship.destinationPortName = p.name;
        ship.destinationPortPosition = { lat: p.lat, lng: p.lng };
      }
    } else if (d.kind === "divert_waypoint") {
      const lat = Number(d.payload.lat);
      const lng = Number(d.payload.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        ship.destinationPortPosition = { lat, lng };
        ship.destinationPortName = "Command waypoint";
      }
    }
    if (ship.speedKnots <= 0 && ship.fuelTonnes > 0) {
      ship.speedKnots = Math.max(ship.cruiseSpeedKnots, 1);
    }
    ship.status = "rerouting";
    this.assignRouteFromPosition(ship.id);
  }

  ackAlert(alertId: string): void {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.acknowledged = true;
    if (a && hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        await db.from("alerts").update({ acknowledged: true }).eq("alert_id", a.id);
      });
    }
  }

  resolveAlert(alertId: string): void {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.resolved = true;
    if (a && hasSupabase && supabase) {
      const db = supabase;
      void safeDb(async () => {
        await db.from("alerts").update({ resolved: true }).eq("alert_id", a.id);
      });
    }
  }
}

function nowString(): string {
  return String(Date.now());
}
