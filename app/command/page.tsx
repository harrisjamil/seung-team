"use client";

import { getSession } from "@/app/lib/auth";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useFleetWs } from "@/lib/useFleetWs";
import { useSupabaseShips } from "@/lib/useSupabaseShips";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandHeader } from "./components/CommandHeader";
import { CommandAlertsFeed } from "./components/CommandAlertsFeed";
import { CommandCards } from "./components/CommandCards";
import { CommandLeftSidebar } from "./components/CommandLeftSidebar";
import { CommandMapPanel } from "./components/CommandMapPanel";
import { CommandRightSidebar } from "./components/CommandRightSidebar";
import {
  CommandAlertsFeedSkeleton,
  CommandCardsSkeleton,
  CommandHeaderSkeleton,
  CommandLeftSidebarSkeleton,
  CommandMapPanelSkeleton,
  CommandRightSidebarSkeleton,
} from "./components/CommandSkeletons";
import { CommandChatFab } from "./components/CommandChatFab";
import { DeleteZoneModal } from "./components/DeleteZoneModal";
import { RestrictedZonesPanel } from "./components/RestrictedZonesPanel";
import { ShipFormModal } from "./components/ShipFormModal";
import { ShipDeleteModal } from "./components/ShipDeleteModal";
import { FleetPlaybackBar, usePlaybackOverlay } from "@/app/components/FleetPlaybackBar";
import { FLEET_CONTENT_PAD, FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import toast from "react-hot-toast";

export default function CommandPage() {
  const router = useRouter();
  const { connected, latest, displayShips, bbox, ports, send, playback, requestPlayback } =
    useFleetWs({
      role: "command",
    });
  const [timelineIdx, setTimelineIdx] = useState<number | null>(null);
  const { ships: supabaseShips } = useSupabaseShips();
  const [selected, setSelected] = useState<string | null>(null);
  const [followSelected, setFollowSelected] = useState(true);
  const [zonePendingDelete, setZonePendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftRing, setDraftRing] = useState<[number, number][]>([]);
  const [shipForm, setShipForm] = useState<
    null | { mode: "create" | "edit"; ship?: FleetShipRuntime }
  >(null);
  const [shipToDelete, setShipToDelete] = useState<FleetShipRuntime | null>(null);
  const seenAlerts = useRef(new Set<string>());
  const intelligenceSectionRef = useRef<HTMLDivElement | null>(null);

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
      const shouldNotify =
        al.type === "geofence_breach" ||
        al.type === "zone_encirclement_entry" ||
        al.type === "zone_proximity" ||
        al.type === "weather_danger" ||
        al.type === "proximity" ||
        al.type === "distress" ||
        al.type === "stranded";
      if (!seenAlerts.current.has(al.id) && shouldNotify) {
        seenAlerts.current.add(al.id);
        toast(`${al.title} — ${al.detail}`, { duration: 6000 });
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.value = 0.055;
          osc.type = "sawtooth";
          osc.frequency.value =
            al.type === "distress"
              ? 880
              : al.type === "weather_danger"
                ? 540
                : al.type === "zone_proximity"
                  ? 480
                  : 620;
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

  const liveShips: FleetShipRuntime[] = displayShips.length
    ? displayShips
    : latest?.ships?.length
      ? latest.ships
      : supabaseShips;

  const currentZones = latest?.zones ?? [];

  const { ships: mapShips, zones: mapZones, snapshotTime } = usePlaybackOverlay(
    playback,
    liveShips,
    currentZones,
    timelineIdx,
  );

  const ships = liveShips;

  const openAlerts = useMemo(
    () => (latest?.alerts ?? []).filter((a) => !a.resolved),
    [latest?.alerts],
  );
  const distressedCount = ships.filter((s) => s.status === "distressed").length;
  const adverseCount = ships.filter((s) => s.weatherAdverse).length;
  const isInitialLoading =
    !latest && displayShips.length === 0 && supabaseShips.length === 0;

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

  const confirmDeleteShip = useCallback(
    (shipId: string) => {
      send({ type: "ship.delete", shipId });
      setShipToDelete(null);
      setSelected((cur) => {
        if (cur !== shipId) return cur;
        const others = ships.filter((s) => s.id !== shipId);
        return others[0]?.id ?? null;
      });
    },
    [send, ships],
  );

  const handleMapPickShip = useCallback((id: string | null) => {
    setSelected(id);
    if (!id) return;
    requestAnimationFrame(() => {
      intelligenceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  if (isInitialLoading) {
    return (
      <div className={FLEET_PAGE_SHELL}>
        <CommandHeaderSkeleton />
        <div className={FLEET_CONTENT_PAD}>
          <CommandCardsSkeleton />
          <CommandAlertsFeedSkeleton />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
              <CommandLeftSidebarSkeleton />
              <CommandMapPanelSkeleton />
            </div>
            <div className="h-32 w-full rounded-2xl border border-slate-200 bg-white/60 animate-pulse" />
            <CommandRightSidebarSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={FLEET_PAGE_SHELL}>
      <CommandHeader
        connected={connected}
        openAlertsCount={openAlerts.length}
        distressedCount={distressedCount}
        adverseCount={adverseCount}
        router={router}
      />

      <div className={FLEET_CONTENT_PAD}>
      <CommandCards
        shipCount={ships.length}
        openAlertsCount={openAlerts.length}
        distressedCount={distressedCount}
        adverseCount={adverseCount}
      />

      <FleetPlaybackBar
        connected={connected}
        snapshots={playback}
        requestPlayback={requestPlayback}
        liveShipCount={ships.length}
        scrubIndex={timelineIdx}
        onScrubIndexChange={setTimelineIdx}
      />

      <CommandAlertsFeed
        alerts={latest?.alerts ?? []}
        openAlertsCount={openAlerts.length}
        onAcknowledgeAlert={acknowledge}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="order-2 min-w-0 lg:order-1">
            <CommandLeftSidebar
              ships={ships}
              selectedId={selected}
              onSelectShip={setSelected}
              shipManagementEnabled
              onEditShip={(s) => setShipForm({ mode: "edit", ship: s })}
              onDeleteShip={(s) => setShipToDelete(s)}
            />
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <CommandMapPanel
              bbox={bbox}
              ships={mapShips}
              zones={mapZones}
              selectedId={selected}
              drawMode={drawMode}
              draftRing={draftRing}
              followSelected={followSelected}
              onPickShip={handleMapPickShip}
              onMapClick={vertexAdd}
              onToggleFollow={() => setFollowSelected((v) => !v)}
              replayHint={
                timelineIdx != null && snapshotTime
                  ? `History · ${new Date(snapshotTime).toLocaleTimeString()}`
                  : null
              }
            />
          </div>
        </div>

        <RestrictedZonesPanel
          drawMode={drawMode}
          draftRing={draftRing}
          currentZones={mapZones}
          onToggleDrawMode={() => {
            setDrawMode((d) => !d);
            setDraftRing([]);
          }}
          onPublishZone={publishZone}
          onClearDraftRing={() => setDraftRing([])}
          onRequestDeleteZone={setZonePendingDelete}
          zoneManagementEnabled
        />

        <div ref={intelligenceSectionRef} className="min-w-0">
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
      </div>

      <ShipFormModal
        open={shipForm != null}
        mode={shipForm?.mode ?? "create"}
        ship={shipForm?.mode === "edit" ? (shipForm.ship ?? null) : null}
        ports={ports}
        onClose={() => setShipForm(null)}
        onSubmit={(payload) => {
          if (payload.mode === "create" && payload.ship) {
            send({ type: "ship.create", ship: payload.ship });
          }
          if (payload.mode === "edit" && payload.shipId && payload.patch) {
            send({ type: "ship.update", shipId: payload.shipId, patch: payload.patch });
          }
          setShipForm(null);
        }}
      />

      <ShipDeleteModal
        ship={shipToDelete}
        onCancel={() => setShipToDelete(null)}
        onConfirm={confirmDeleteShip}
      />

      <DeleteZoneModal
        zone={zonePendingDelete}
        onCancel={() => setZonePendingDelete(null)}
        onConfirm={deleteZone}
      />

      <CommandChatFab />
      </div>
    </div>
  );
}