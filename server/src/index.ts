import "dotenv/config";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";

import type { FleetShipConfig, Role } from "./types.js";
import { SimEngine } from "./sim.js";
import { hasSupabase, safeDb, supabase } from "./supabase.js";

const PORT = Number(process.env.PORT ?? 8080);
const sim = new SimEngine(Number(process.env.TICK_SECONDS ?? 0.25));

const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        ships: sim.ships.length,
        supabase: hasSupabase,
        metrics: metricsSnapshot(),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

type ClientMeta = {
  role: Role;
  shipId?: string;
};

const wss = new WebSocketServer({ server: httpServer });
const clients = new Set<WebSocket>();
const clientMeta = new Map<WebSocket, ClientMeta>();

type RuntimeMetrics = {
  startedAt: number;
  tickCount: number;
  sendDurationsMs: number[];
  fanoutLagMs: number[];
  lastTickAt: number;
};

const metrics: RuntimeMetrics = {
  startedAt: Date.now(),
  tickCount: 0,
  sendDurationsMs: [],
  fanoutLagMs: [],
  lastTickAt: 0,
};

const METRIC_WINDOW = 240;

function pushMetric(buf: number[], value: number): void {
  buf.push(value);
  if (buf.length > METRIC_WINDOW) buf.shift();
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function metricsSnapshot() {
  const uptimeMs = Date.now() - metrics.startedAt;
  const tickHz = uptimeMs > 0 ? (metrics.tickCount * 1000) / uptimeMs : 0;
  return {
    uptimeMs,
    connectedClients: clients.size,
    tickHz: Number(tickHz.toFixed(2)),
    tickSeconds: sim.tickSeconds,
    fanoutSendP95Ms: Number(percentile(metrics.sendDurationsMs, 0.95).toFixed(2)),
    stateFanoutLagP95Ms: Number(percentile(metrics.fanoutLagMs, 0.95).toFixed(2)),
    lastTickAt: metrics.lastTickAt,
  };
}

function broadcast(obj: unknown) {
  const msg = JSON.stringify(obj);
  const started = Date.now();
  const eventTs =
    typeof obj === "object" &&
    obj !== null &&
    "data" in obj &&
    typeof (obj as { data?: { t?: unknown } }).data?.t === "number"
      ? Number((obj as { data: { t: number } }).data.t)
      : Date.now();
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
  const elapsed = Date.now() - started;
  pushMetric(metrics.sendDurationsMs, elapsed);
  pushMetric(metrics.fanoutLagMs, Date.now() - eventTs);
}

function send(ws: WebSocket, obj: unknown) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

setInterval(() => {
  const tickNow = Date.now();
  const payload = sim.step(tickNow);
  metrics.tickCount += 1;
  metrics.lastTickAt = tickNow;
  broadcast({ type: "state", data: payload });
}, sim.tickSeconds * 1000).unref?.();

wss.on("connection", (ws) => {
  clients.add(ws);
  send(ws, {
    type: "hello",
    tickSeconds: sim.tickSeconds,
    bbox: sim.fleet.bbox,
    ports: sim.fleet.ports,
  });
  send(ws, { type: "state", data: snapshotNow() });

  ws.on("close", () => {
    clients.delete(ws);
    clientMeta.delete(ws);
  });

  ws.on("message", (raw: RawData) => {
    void handleMessage(ws, raw.toString());
  });
});

function snapshotNow() {
  return {
    t: Date.now(),
    tickSeconds: sim.tickSeconds,
    ships: sim.ships.map((s) => structuredClone(s)),
    zones: sim.zones.map((z) => structuredClone(z)),
    alerts: sim.alerts.map((a) => structuredClone(a)),
    directives: sim.directives.map((d) => structuredClone(d)),
  };
}

async function handleMessage(ws: WebSocket, raw: string) {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const type = String(msg.type ?? "");

  if (type === "auth") {
    const role = (String(msg.role) as Role) || "spectator";
    const shipId = msg.shipId != null ? String(msg.shipId) : undefined;
    clientMeta.set(ws, {
      role: role === "command" || role === "captain" ? role : "spectator",
      shipId,
    });
    send(ws, { type: "auth_ok", role: clientMeta.get(ws)?.role });
    return;
  }

  const meta = clientMeta.get(ws) ?? { role: "spectator" as const };

  if (type === "zone.create" && meta.role === "command") {
    const zone = msg.zone as {
      id?: string;
      name?: string;
      ring?: [number, number][];
    };
    if (!zone?.ring?.length) return;
    sim.addZone({
      id: zone.id ?? `z-${Math.random().toString(36).slice(2, 9)}`,
      name: zone.name ?? "Restricted",
      ring: zone.ring,
    });
    return;
  }

  if (type === "zone.update" && meta.role === "command") {
    const id = String(msg.id ?? "");
    const ring = msg.ring as [number, number][] | undefined;
    if (!id || !ring) return;
    sim.updateZone(id, ring, msg.name != null ? String(msg.name) : undefined);
    return;
  }

  if (type === "zone.delete" && meta.role === "command") {
    sim.deleteZone(String(msg.id ?? ""));
    return;
  }

  if (type === "ship.create" && meta.role === "command") {
    const s = msg.ship as Partial<FleetShipConfig> | undefined;
    if (!s?.id?.trim() || !s.name?.trim()) {
      send(ws, { type: "error", message: "ship.create requires id and name." });
      return;
    }
    const cargo =
      s.cargo && typeof s.cargo === "object" ? (s.cargo as Record<string, unknown>) : {};
    const result = sim.createShip({
      id: String(s.id).trim(),
      name: String(s.name).trim(),
      lat: Number(s.lat),
      lng: Number(s.lng),
      headingDeg: Number(s.headingDeg ?? 0),
      speedKnots: Number(s.speedKnots ?? 12),
      destinationPortId: String(s.destinationPortId ?? ""),
      fuelTonnes: Number(s.fuelTonnes ?? 400),
      fuelBurnTonnesPerNm: Number(s.fuelBurnTonnesPerNm ?? 0.045),
      cargo,
    });
    if (!result.ok) send(ws, { type: "error", message: result.error });
    return;
  }

  if (type === "ship.update" && meta.role === "command") {
    const shipId = String(msg.shipId ?? "").trim();
    if (!shipId) {
      send(ws, { type: "error", message: "ship.update requires shipId." });
      return;
    }
    const p = msg.patch as Partial<FleetShipConfig>;
    const patch: Partial<Omit<FleetShipConfig, "id">> = {};
    if (p.name != null) patch.name = String(p.name);
    if (p.lat != null && Number.isFinite(Number(p.lat))) patch.lat = Number(p.lat);
    if (p.lng != null && Number.isFinite(Number(p.lng))) patch.lng = Number(p.lng);
    if (p.headingDeg != null && Number.isFinite(Number(p.headingDeg)))
      patch.headingDeg = Number(p.headingDeg);
    if (p.speedKnots != null && Number.isFinite(Number(p.speedKnots)))
      patch.speedKnots = Number(p.speedKnots);
    if (p.destinationPortId != null) patch.destinationPortId = String(p.destinationPortId);
    if (p.fuelTonnes != null && Number.isFinite(Number(p.fuelTonnes)))
      patch.fuelTonnes = Number(p.fuelTonnes);
    if (p.fuelBurnTonnesPerNm != null && Number.isFinite(Number(p.fuelBurnTonnesPerNm)))
      patch.fuelBurnTonnesPerNm = Number(p.fuelBurnTonnesPerNm);
    if (p.cargo != null && typeof p.cargo === "object") {
      patch.cargo = p.cargo as Record<string, unknown>;
    }
    const result = sim.updateShip(shipId, patch);
    if (!result.ok) send(ws, { type: "error", message: result.error });
    return;
  }

  if (type === "ship.delete" && meta.role === "command") {
    const shipId = String(msg.shipId ?? "").trim();
    if (!shipId) {
      send(ws, { type: "error", message: "ship.delete requires shipId." });
      return;
    }
    const result = sim.deleteShip(shipId);
    if (!result.ok) send(ws, { type: "error", message: result.error });
    return;
  }

  if (type === "directive.issue" && meta.role === "command") {
    const shipId = String(msg.shipId ?? "");
    const kind = String(msg.kind ?? "reroute_port") as
      | "reroute_port"
      | "divert_waypoint"
      | "hold_position";
    const payload = (msg.payload as Record<string, unknown>) ?? {};
    sim.issueDirective({ shipId, kind, payload });
    return;
  }

  if (type === "directive.respond" && meta.role === "captain") {
    const captainsShip = meta.shipId;
    const dirId = String(msg.directiveId ?? "");
    const response = String(msg.response ?? "") as
      | "ACCEPT"
      | "ESCALATE_DISTRESS";
    const d = sim.directives.find((x) => x.id === dirId);
    if (!d || (captainsShip && d.shipId !== captainsShip)) {
      send(ws, { type: "error", message: "Directive not found for this captain" });
      return;
    }
    await sim.respondDirective(
      dirId,
      response,
      msg.message != null ? String(msg.message) : undefined,
    );
    return;
  }

  if (type === "alert.ack") {
    sim.ackAlert(String(msg.alertId ?? ""));
    return;
  }

  if (type === "alert.resolve") {
    sim.resolveAlert(String(msg.alertId ?? ""));
    return;
  }

  if (type === "playback.request") {
    const dbSnapshots = await getPlaybackFromSupabase();
    send(ws, {
      type: "playback",
      snapshots: dbSnapshots?.length ? dbSnapshots : sim.playback.snapshots,
    });
    return;
  }
}

async function getPlaybackFromSupabase() {
  const db = supabase;
  if (!hasSupabase || !db) return null;
  return safeDb(async () => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const { data } = await db
      .from("ship_history")
      .select("t,ships,alerts,zones")
      .gte("t", cutoff)
      .order("t", { ascending: true })
      .limit(160);
    if (!data) return null;
    return data.map((row) => ({
      t: Number(row.t),
      ships: row.ships,
      alerts: row.alerts,
      zones: row.zones,
    }));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Fleet simulator listening on :${PORT} (tick ${sim.tickSeconds}s)`);
});
