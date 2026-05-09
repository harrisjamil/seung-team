import "dotenv/config";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { SimEngine } from "./sim.js";
const PORT = Number(process.env.PORT ?? 8080);
const sim = new SimEngine(Number(process.env.TICK_SECONDS ?? 0.25));
const httpServer = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ships: sim.ships.length }));
        return;
    }
    res.writeHead(404);
    res.end();
});
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();
const clientMeta = new Map();
function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of clients) {
        if (ws.readyState === 1)
            ws.send(msg);
    }
}
function send(ws, obj) {
    if (ws.readyState === 1)
        ws.send(JSON.stringify(obj));
}
setInterval(() => {
    const payload = sim.step(Date.now());
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
    ws.on("message", (raw) => {
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
async function handleMessage(ws, raw) {
    let msg;
    try {
        msg = JSON.parse(raw);
    }
    catch {
        return;
    }
    const type = String(msg.type ?? "");
    if (type === "auth") {
        const role = String(msg.role) || "spectator";
        const shipId = msg.shipId != null ? String(msg.shipId) : undefined;
        clientMeta.set(ws, {
            role: role === "command" || role === "captain" ? role : "spectator",
            shipId,
        });
        send(ws, { type: "auth_ok", role: clientMeta.get(ws)?.role });
        return;
    }
    const meta = clientMeta.get(ws) ?? { role: "spectator" };
    if (type === "zone.create" && meta.role === "command") {
        const zone = msg.zone;
        if (!zone?.ring?.length)
            return;
        sim.addZone({
            id: zone.id ?? `z-${Math.random().toString(36).slice(2, 9)}`,
            name: zone.name ?? "Restricted",
            ring: zone.ring,
        });
        return;
    }
    if (type === "zone.update" && meta.role === "command") {
        const id = String(msg.id ?? "");
        const ring = msg.ring;
        if (!id || !ring)
            return;
        sim.updateZone(id, ring, msg.name != null ? String(msg.name) : undefined);
        return;
    }
    if (type === "zone.delete" && meta.role === "command") {
        sim.deleteZone(String(msg.id ?? ""));
        return;
    }
    if (type === "directive.issue" && meta.role === "command") {
        const shipId = String(msg.shipId ?? "");
        const kind = String(msg.kind ?? "reroute_port");
        const payload = msg.payload ?? {};
        sim.issueDirective({ shipId, kind, payload });
        return;
    }
    if (type === "directive.respond" && meta.role === "captain") {
        const captainsShip = meta.shipId;
        const dirId = String(msg.directiveId ?? "");
        const response = String(msg.response ?? "");
        const d = sim.directives.find((x) => x.id === dirId);
        if (!d || (captainsShip && d.shipId !== captainsShip)) {
            send(ws, { type: "error", message: "Directive not found for this captain" });
            return;
        }
        await sim.respondDirective(dirId, response, msg.message != null ? String(msg.message) : undefined);
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
        send(ws, { type: "playback", snapshots: sim.playback.snapshots });
        return;
    }
}
httpServer.listen(PORT, () => {
    console.log(`Fleet simulator listening on :${PORT} (tick ${sim.tickSeconds}s)`);
});
