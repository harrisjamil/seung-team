"use client";

import { getSession } from "@/app/lib/auth";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useFleetWs } from "@/lib/useFleetWs";
import { useSupabaseShips } from "@/lib/useSupabaseShips";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandHeader } from "./components/CommandHeader";
import { CommandLeftSidebar } from "./components/CommandLeftSidebar";
import { CommandMapPanel } from "./components/CommandMapPanel";
import { CommandRightSidebar } from "./components/CommandRightSidebar";
import { DeleteZoneModal } from "./components/DeleteZoneModal";

export default function CommandPage() {
  const router = useRouter();
  const { connected, latest, displayShips, bbox, ports, send } = useFleetWs({
    role: "command",
  });
  const { ships: supabaseShips } = useSupabaseShips();
  const [selected, setSelected] = useState<string | null>(null);
  const [followSelected, setFollowSelected] = useState(true);
  const [zonePendingDelete, setZonePendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftRing, setDraftRing] = useState<[number, number][]>([]);
  const seenAlerts = useRef(new Set<string>());

  const [directiveKind, setDirectiveKind] = useState<
    "reroute_port" | "divert_waypoint" | "hold_position"
  >("reroute_port");
  const [selectedPortId, setSelectedPortId] = useState<string>("");
  const [wayLat, setWayLat] = useState("26.15");
  const [wayLng, setWayLng] = useState("56.25");

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "command") router.replace("/");
  }, [router]);

  useEffect(() => {
    const alerts = latest?.alerts ?? [];
    for (const al of alerts) {
      if (al.acknowledged || al.resolved) continue;
      const severe =
        al.type === "geofence_breach" ||
        al.type === "proximity" ||
        al.type === "distress" ||
        al.type === "stranded";
      if (!seenAlerts.current.has(al.id) && severe) {
        seenAlerts.current.add(al.id);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.value = 0.06;
          osc.type = "sawtooth";
          osc.frequency.value = al.type === "distress" ? 880 : 620;
          osc.start();
          setTimeout(() => {
            osc.stop();
            ctx.close().catch(() => undefined);
          }, 220);
        } catch {
          // ignore audio failures
        }
      }
    }
  }, [latest?.alerts]);

  const selShip = useMemo(() => {
    if (!selected) return undefined;
    return (
      displayShips.find((s) => s.id === selected) ??
      latest?.ships.find((s) => s.id === selected)
    );
  }, [displayShips, latest, selected]);

  const ships: FleetShipRuntime[] = displayShips.length
    ? displayShips
    : latest?.ships?.length
      ? latest.ships
      : supabaseShips;

  const openAlerts = useMemo(
    () => (latest?.alerts ?? []).filter((a) => !a.resolved),
    [latest?.alerts],
  );
  const currentZones = latest?.zones ?? [];
  const distressedCount = ships.filter((s) => s.status === "distressed").length;
  const adverseCount = ships.filter((s) => s.weatherAdverse).length;

  useEffect(() => {
    if (!selected && ships.length) setSelected(ships[0].id);
  }, [selected, ships]);

  const vertexAdd = useCallback((lng: number, lat: number) => {
    setDraftRing((r) => [...r, [lng, lat]]);
  }, []);

  const publishZone = useCallback(() => {
    if (draftRing.length < 3) return;
    send({
      type: "zone.create",
      zone: {
        name: `Zone ${new Date().toISOString().slice(11, 19)}`,
        ring: [...draftRing, draftRing[0]],
      },
    });
    setDraftRing([]);
    setDrawMode(false);
  }, [draftRing, send]);

  const acknowledge = useCallback(
    (alertId: string, resolved: boolean) => {
      send(resolved ? { type: "alert.resolve", alertId } : { type: "alert.ack", alertId });
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

    send({ type: "directive.issue", shipId, kind: directiveKind, payload });
  }, [directiveKind, selected, selectedPortId, selShip?.id, send, wayLat, wayLng]);

  const deleteZone = useCallback(
    (zoneId: string) => {
      if (!zoneId) return;
      send({ type: "zone.delete", id: zoneId });
      setZonePendingDelete(null);
    },
    [send],
  );

  return (
    <div className="flex min-h-screen flex-col gap-5 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 lg:p-6">
      <CommandHeader
        connected={connected}
        openAlertsCount={openAlerts.length}
        distressedCount={distressedCount}
        adverseCount={adverseCount}
        router={router}
      />

      <div className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr_340px]">
        <CommandLeftSidebar
          ships={ships}
          selectedId={selected}
          drawMode={drawMode}
          draftRing={draftRing}
          currentZones={currentZones}
          alerts={latest?.alerts ?? []}
          openAlertsCount={openAlerts.length}
          onSelectShip={setSelected}
          onToggleDrawMode={() => {
            setDrawMode((d) => !d);
            setDraftRing([]);
          }}
          onPublishZone={publishZone}
          onClearDraftRing={() => setDraftRing([])}
          onRequestDeleteZone={setZonePendingDelete}
          onAcknowledgeAlert={acknowledge}
        />

        <CommandMapPanel
          bbox={bbox}
          ships={ships}
          zones={currentZones}
          selectedId={selected}
          drawMode={drawMode}
          draftRing={draftRing}
          followSelected={followSelected}
          onPickShip={setSelected}
          onMapClick={vertexAdd}
          onToggleFollow={() => setFollowSelected((v) => !v)}
        />

        <CommandRightSidebar
          selShip={selShip}
          directiveKind={directiveKind}
          selectedPortId={selectedPortId}
          wayLat={wayLat}
          wayLng={wayLng}
          ports={ports}
          onDirectiveKindChange={setDirectiveKind}
          onSelectedPortIdChange={setSelectedPortId}
          onWayLatChange={setWayLat}
          onWayLngChange={setWayLng}
          onIssueDirective={issueDirective}
        />
      </div>

      <DeleteZoneModal
        zone={zonePendingDelete}
        onCancel={() => setZonePendingDelete(null)}
        onConfirm={deleteZone}
      />
    </div>
  );
}