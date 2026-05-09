"use client";

import { FleetMap } from "@/components/FleetMap";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useFleetWs } from "@/lib/useFleetWs";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";

export default function CommandPage() {
  const { connected, latest, displayShips, bbox, ports, send } = useFleetWs({
    role: "command",
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftRing, setDraftRing] = useState<[number, number][]>([]);
  const seenAlerts = useRef(new Set<string>());

  const [directiveKind, setDirectiveKind] = useState<
    "reroute_port" | "divert_waypoint" | "hold_position"
  >("reroute_port");
  const [selectedPortId, setSelectedPortId] = useState<string>("");
  const [wayLat, setWayLat] = useState("26.15");
  const [wayLng, setWayLng] = useState("56.25");

  /** Audible cue for severe unacknowledged alerts */
  useEffect(() => {
    const alerts = latest?.alerts ?? [];
    for (const al of alerts) {
      if (al.acknowledged || al.resolved) continue;
      if (
        !seenAlerts.current.has(al.id) &&
        (al.type === "geofence_breach" ||
          al.type === "proximity" ||
          al.type === "distress" ||
          al.type === "stranded")
      ) {
        seenAlerts.current.add(al.id);
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.value = 0.06;
          o.type = "sawtooth";
          o.frequency.value = al.type === "distress" ? 880 : 620;
          o.start();
          setTimeout(() => {
            o.stop();
            ctx.close().catch(() => undefined);
          }, 220);
        } catch {
          /** ignore audio failures */
        }
      }
    }
  }, [latest?.alerts]);

  const selShip = useMemo(() => {
    const id = selected;
    if (!id) return undefined;
    return [...displayShips].find((s) => s.id === id) ??
      latest?.ships.find((s) => s.id === id);
  }, [selected, displayShips, latest]);

  const vertexAdd = useCallback((lng: number, lat: number) => {
    setDraftRing((r) => [...r, [lng, lat]]);
  }, []);

  const publishZone = useCallback(() => {
    if (draftRing.length < 3) return;
    const ring = [...draftRing, draftRing[0]];
    send({
      type: "zone.create",
      zone: {
        name: `Zone ${new Date().toISOString().slice(11, 19)}`,
        ring,
      },
    });
    setDraftRing([]);
    setDrawMode(false);
  }, [draftRing, send]);

  const acknowledge = useCallback(
    (alertId: string, resolved: boolean) => {
      if (resolved) send({ type: "alert.resolve", alertId });
      else send({ type: "alert.ack", alertId });
    },
    [send],
  );

  const issueDirective = useCallback(() => {
    const shipId = selShip?.id ?? selected;
    if (!shipId) return;
    let payload: Record<string, unknown> = {};
    if (directiveKind === "reroute_port") {
      if (!selectedPortId) return;
      payload = { portId: selectedPortId };
    } else if (directiveKind === "divert_waypoint") {
      const lat = Number(wayLat);
      const lng = Number(wayLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      payload = { lat, lng };
    }
    send({
      type: "directive.issue",
      shipId,
      kind: directiveKind,
      payload,
    });
  }, [directiveKind, selShip, selected, selectedPortId, send, wayLat, wayLng]);

  const ships: FleetShipRuntime[] = displayShips.length
    ? displayShips
    : latest?.ships ?? [];

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-slate-950 p-4 text-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fleet command</h1>
          <p className="text-sm text-slate-400">
            Real-time crisis ops — Hormuz scenario · {connected ? "live" : "connecting…"}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/" className="text-sky-400 underline">
            Home
          </Link>
          <Link href="/captain" className="text-sky-400 underline">
            Captain consoles
          </Link>
        </div>
      </header>

      <div className="grid flex-1 gap-3 lg:grid-cols-[280px_1fr_300px]">
        <aside className="flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <h2 className="text-sm font-medium text-slate-300">Fleet (15)</h2>
          <ul className="max-h-[260px] overflow-y-auto text-sm">
            {ships.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`mb-1 w-full rounded-md px-2 py-1 text-left ${
                    selected === s.id
                      ? "bg-sky-600/50 text-white"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.status} · fuel {s.fuelTonnes.toFixed(0)} t
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase text-slate-500">Restricted zones</span>
              <button
                type="button"
                onClick={() => {
                  setDrawMode((d) => !d);
                  setDraftRing([]);
                }}
                className={`rounded px-2 py-1 text-xs ${drawMode ? "bg-amber-600" : "bg-slate-700"}`}
              >
                {drawMode ? "Drawing…" : "Draw zone"}
              </button>
            </div>
            {drawMode ? (
              <div className="mt-2 flex flex-col gap-2 text-xs">
                <p className="text-slate-400">
                  Click map to add vertices ({draftRing.length}). Finish closes the ring.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1"
                    onClick={publishZone}
                    disabled={draftRing.length < 3}
                  >
                    Publish zone
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1"
                    onClick={() => setDraftRing([])}
                  >
                    Clear sketch
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-red-200">Alerts</span>
              <span className="text-[10px] text-red-300">
                {(latest?.alerts ?? []).filter((a) => !a.resolved).length} open
              </span>
            </div>
            <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto text-xs">
              {(latest?.alerts ?? []).map((a) => (
                <li
                  key={a.id}
                  className={`rounded border p-2 ${
                    a.resolved
                      ? "border-slate-700 opacity-50"
                      : "border-red-800 bg-red-950/50"
                  }`}
                >
                  <div className="font-medium text-red-100">{a.title}</div>
                  <div className="text-[11px] text-red-200/80">{a.detail}</div>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-0.5"
                      onClick={() => acknowledge(a.id, false)}
                      disabled={a.acknowledged}
                    >
                      Ack
                    </button>
                    <button
                      type="button"
                      className="rounded bg-emerald-900 px-2 py-0.5"
                      onClick={() => acknowledge(a.id, true)}
                      disabled={a.resolved}
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <FleetMap
          bbox={bbox}
          ships={ships}
          zones={latest?.zones ?? []}
          selectedId={selected}
          onPickShip={setSelected}
          drawMode={drawMode}
          draftRing={draftRing}
          onMapClick={vertexAdd}
        />

        <aside className="flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <h2 className="text-sm font-medium text-slate-300">Selected vessel</h2>
          {selShip ? (
            <div className="space-y-2 text-xs">
              <div>
                <div className="text-lg font-semibold">{selShip.name}</div>
                <div className="text-slate-400">{selShip.id}</div>
              </div>
              <Row label="Status" value={selShip.status} />
              <Row label="Speed" value={`${selShip.speedKnots.toFixed(1)} kn`} />
              <Row label="Heading" value={`${selShip.headingDeg.toFixed(0)}°`} />
              <Row label="Destination" value={selShip.destinationPortName} />
              <Row
                label="Fuel"
                value={`${selShip.fuelTonnes.toFixed(1)} t · burn ${selShip.fuelBurnTonnesPerNm}/nm`}
              />
              <Row
                label="Weather"
                value={selShip.weatherAdverse ? "Adverse (+30% burn)" : "Within limits"}
              />
              <Row
                label="Fuel projection"
                value={
                  selShip.fuelRequiredRemainingTonnes != null
                    ? `${selShip.fuelRequiredRemainingTonnes.toFixed(1)} t est. remaining path`
                    : "—"
                }
              />
              <div>
                <div className="text-slate-500">Cargo</div>
                <pre className="mt-1 max-h-[120px] overflow-auto rounded bg-slate-950 p-2 text-[11px]">
                  {JSON.stringify(selShip.cargo, null, 2)}
                </pre>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 text-slate-500">Directive to captain</div>
                <select
                  className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
                  value={directiveKind}
                  onChange={(e) =>
                    setDirectiveKind(e.target.value as typeof directiveKind)
                  }
                >
                  <option value="reroute_port">Reroute to port</option>
                  <option value="divert_waypoint">Divert to waypoint</option>
                  <option value="hold_position">Hold position</option>
                </select>
                {directiveKind === "reroute_port" ? (
                  <select
                    className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
                    value={selectedPortId}
                    onChange={(e) => setSelectedPortId(e.target.value)}
                  >
                    <option value="">Select port…</option>
                    {ports &&
                      Object.entries(ports).map(([pid, p]) => (
                        <option key={pid} value={pid}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                ) : null}
                {directiveKind === "divert_waypoint" ? (
                  <div className="mb-2 flex gap-2">
                    <input
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                      placeholder="lat"
                      value={wayLat}
                      onChange={(e) => setWayLat(e.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                      placeholder="lng"
                      value={wayLng}
                      onChange={(e) => setWayLng(e.target.value)}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded-md bg-sky-600 px-3 py-2 font-medium"
                  onClick={issueDirective}
                >
                  Issue directive
                </button>
                <p className="mt-2 text-[11px] text-slate-500">
                  Captains must ACCEPT or ESCALATE_DISTRESS; changes apply on next sim tick
                  after acceptance.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Select a ship on the map or list.</p>
          )}

          <div className="mt-auto border-t border-slate-800 pt-3 text-[11px] text-slate-500">
            WebSocket (no polling) · Open-Meteo wind for adverse weather · Distress NLP optional
            (OPENAI_API_KEY).
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-100">{value}</div>
    </div>
  );
}
