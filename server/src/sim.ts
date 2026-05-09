import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bearingDegrees,
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
  FleetShipRuntime,
  PlaybackBuffer,
  RestrictedZone,
  SimStatePayload,
  LatLng,
} from "./types.js";
import { parseDistressMessage, distressSeverityScore } from "./nlp.js";
import { computeRoute } from "./routing.js";
import { fetchWeatherAt } from "./weather.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  t0 = Date.now();

  readonly tickSeconds: number;

  constructor(tickSeconds = 1 / 4) {
    this.tickSeconds = tickSeconds;
    this.reloadFleet();
    this.snapshotPlaybackThrottled(Date.now(), true);
    setInterval(() => {
      void this.refreshWeatherForShips().catch(() => undefined);
    }, 7000).unref?.();
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
    const s = this.ships.find((x) => x.id === shipId);
    if (!s) return;
    if (s.status === "stopped") {
      return;
    }

    /** Hold / arrived vessels do not auto-navigate unless status changes externally */
    if (s.status === "arrived") {
      return;
    }

    const prevStatus = s.status;
    const r = computeRoute(this.fleet, this.zones, s.position, s.destinationPortPosition, 0.03);
    if (r.unreachable || r.waypoints.length < 2) {
      s.status = "stranded";
      s.route = [];
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

    s.route = r.waypoints.length > 1 ? r.waypoints.slice(1) : [];
    s.routeMeta = { pathNm: r.pathNm, insideAdverseNm: 0 };
    this.updateHeadingTowardWaypoint(s);

    const preserve =
      prevStatus === "distressed" || prevStatus === "insufficient_fuel";
    if (!preserve) {
      s.status = "normal";
    }
    this.updateFuelProjection(s);
  }

  private updateFuelProjection(s: FleetShipRuntime): void {
    if (
      !s.route.length &&
      haversineKm(s.position, s.destinationPortPosition) < 0.85
    ) {
      s.fuelRequiredRemainingTonnes =
        nmFromKm(haversineKm(s.position, s.destinationPortPosition)) *
        s.fuelBurnTonnesPerNm *
        (s.weatherAdverse ? 1.3 : 1);
    } else {
      let nmRem = nmFromKm(haversineKm(s.position, s.destinationPortPosition));
      /** crude: approximate along route */
      nmRem =
        nmFromKm(haversineKm(s.position, s.route[0] ?? s.destinationPortPosition));
      let accNm = nmRem;
      for (let i = 0; i < s.route.length - 1; i++) {
        accNm += nmFromKm(haversineKm(s.route[i], s.route[i + 1]));
      }
      nmRem = accNm;
      const adverseFactor = s.weatherAdverse ? 1.3 : 1;
      s.fuelRequiredRemainingTonnes = nmRem * s.fuelBurnTonnesPerNm * adverseFactor;
    }
    if (
      typeof s.fuelRequiredRemainingTonnes === "number" &&
      s.fuelRequiredRemainingTonnes > s.fuelTonnes * 1.001 &&
      s.status !== "arrived"
    ) {
      if (s.status !== "insufficient_fuel") {
        this.raiseAlert({
          type: "fuel_low",
          severityScore: 75,
          title: `Insufficient fuel projection: ${s.name}`,
          detail: `Projected consumption exceeds remaining bunker on current routing snapshot.`,
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
      const factor = s.weatherAdverse ? 1.3 : 1;
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
              title: "Proximity warning",
              detail: `${a.name} and ${b.name} within 2 km.`,
              shipIds: [a.id, b.id],
            });
          }
        } else {
          this.proximityActive.delete(pk);
        }
      }
    }

    this.snapshotPlaybackThrottled(now, false);

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
  }

  addZone(z: Omit<RestrictedZone, "createdAt">): void {
    const zone: RestrictedZone = { ...z, createdAt: Date.now() };
    this.zones.push(zone);
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
    ship.status = "rerouting";
    this.assignRouteFromPosition(ship.id);
  }

  ackAlert(alertId: string): void {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.acknowledged = true;
  }

  resolveAlert(alertId: string): void {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.resolved = true;
  }
}

function nowString(): string {
  return String(Date.now());
}
