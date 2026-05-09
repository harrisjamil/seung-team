"use client";

import { mergeSession, getSession, type AppSession } from "@/app/lib/auth";
import { CaptainHeader } from "@/app/captain/components/CaptainHeader";
import { CommandAlertsFeed } from "@/app/command/components/CommandAlertsFeed";
import { CommandCards } from "@/app/command/components/CommandCards";
import { CommandLeftSidebar } from "@/app/command/components/CommandLeftSidebar";
import { CommandMapPanel } from "@/app/command/components/CommandMapPanel";
import { CommandRightSidebar } from "@/app/command/components/CommandRightSidebar";
import {
  CommandAlertsFeedSkeleton,
  CommandCardsSkeleton,
  CommandHeaderSkeleton,
  CommandLeftSidebarSkeleton,
  CommandMapPanelSkeleton,
  CommandRightSidebarSkeleton,
} from "@/app/command/components/CommandSkeletons";
import { RestrictedZonesPanel } from "@/app/command/components/RestrictedZonesPanel";
import { CommandChatFab } from "@/app/command/components/CommandChatFab";
import { FleetPlaybackBar, usePlaybackOverlay } from "@/app/components/FleetPlaybackBar";
import { FLEET_CONTENT_PAD, FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { FLEET_DEFAULT_PORTS } from "@/lib/fleetDefaultPorts";
import { useFleetWs } from "@/lib/useFleetWs";
import { useSupabaseShips } from "@/lib/useSupabaseShips";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";

function CaptainBridgeInner() {
  const router = useRouter();
  const [shipId, setShipId] = useState<string | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "captain") {
      router.replace("/");
    }
    window.queueMicrotask(() => {
      setSession(s ?? null);
      setShipId(s?.shipId ?? null);
      setClientReady(true);
    });
  }, [router]);

  useEffect(() => {
    const s = getSession();
    if (!s?.userId) return;
    const u = s.userId;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/auth/profile?userId=${encodeURIComponent(u)}`, {
            cache: "no-store",
          });
          const json = (await res.json()) as {
            ok?: boolean;
            session?: AppSession;
          };
          if (res.ok && json.ok && json.session) {
            const next: Parameters<typeof mergeSession>[0] = {
              displayName: json.session.displayName,
            };
            if (json.session.shipId != null) {
              next.shipId = json.session.shipId;
            }
            mergeSession(next);
            if (json.session.shipId) {
              setShipId(json.session.shipId);
            }
          }
        } catch {
          toast.error("Couldn't refresh your profile.");
        }
      })();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const { connected, latest, displayShips, bbox, ports, send, playback, requestPlayback } =
    useFleetWs({
      role: "captain",
      shipId: shipId ?? undefined,
    });
  const effectivePorts = ports ?? FLEET_DEFAULT_PORTS;
  const { ships: supabaseShips } = useSupabaseShips();
  const [timelineIdx, setTimelineIdx] = useState<number | null>(null);

  const liveFleetShips: FleetShipRuntime[] = useMemo(() => {
    if (displayShips.length) return displayShips;
    if (latest?.ships?.length) return latest.ships;
    return supabaseShips;
  }, [displayShips, latest?.ships, supabaseShips]);

  const liveZones = latest?.zones ?? [];
  const { ships: mapShips, zones: mapZones, snapshotTime } = usePlaybackOverlay(
    playback,
    liveFleetShips,
    liveZones,
    timelineIdx,
  );

  const ships = liveFleetShips;

  const myShip = useMemo(
    () => (shipId ? ships.find((s) => s.id === shipId) : undefined),
    [ships, shipId],
  );

  const rosterShips = useMemo(
    () => (myShip ? [myShip] : []),
    [myShip],
  );

  const pendingDirectives = useMemo(() => {
    if (!shipId) return [];
    return (latest?.directives ?? []).filter((d) => d.shipId === shipId && !d.response);
  }, [latest?.directives, shipId]);

  const [captainMsg, setCaptainMsg] = useState("");

  const respond = useCallback(
    (directiveId: string, response: "ACCEPT" | "ESCALATE_DISTRESS", message?: string) => {
      send({
        type: "directive.respond",
        directiveId,
        response,
        ...(response === "ESCALATE_DISTRESS" && message ? { message } : {}),
      });
      setCaptainMsg("");
    },
    [send],
  );

  const allAlerts = useMemo(() => latest?.alerts ?? [], [latest?.alerts]);
  const myAlerts = useMemo(() => {
    if (!shipId) return [];
    return allAlerts.filter((a) => a.shipIds.includes(shipId));
  }, [allAlerts, shipId]);

  const openMyAlerts = useMemo(() => myAlerts.filter((a) => !a.resolved), [myAlerts]);

  const distressedMine = myShip?.status === "distressed" ? 1 : 0;
  const adverseMine = myShip?.weatherAdverse ? 1 : 0;

  const seenAlerts = useRef(new Set<string>());

  useEffect(() => {
    for (const al of myAlerts) {
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
          // ignore
        }
      }
    }
  }, [myAlerts]);

  const acknowledge = useCallback(
    (alertId: string, resolved: boolean) => {
      send(resolved ? { type: "alert.resolve", alertId } : { type: "alert.ack", alertId });
    },
    [send],
  );

  const [directiveKind, setDirectiveKind] = useState<
    "reroute_port" | "divert_waypoint" | "hold_position"
  >("reroute_port");
  const [selectedPortId, setSelectedPortId] = useState("");
  const [wayLat, setWayLat] = useState("26.15");
  const [wayLng, setWayLng] = useState("56.25");

  const noopIssue = useCallback(() => undefined, []);

  if (!clientReady || !session || session.role !== "captain") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-600">
        {!clientReady || !session ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  const isInitialLoading =
    !latest && displayShips.length === 0 && supabaseShips.length === 0 && shipId;

  if (isInitialLoading && shipId) {
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
      <CaptainHeader
        connected={connected}
        openAlertsCount={openMyAlerts.length}
        distressedCount={distressedMine}
        adverseCount={adverseMine}
        router={router}
      />

      <div className={FLEET_CONTENT_PAD}>
      {!shipId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No vessel is assigned to your account. Ask Fleet Command to assign a ship (Command →
          Assignments), then refresh this page or log in again.
        </div>
      ) : null}

      <CommandCards
        variant="captain"
        shipCount={shipId ? 1 : 0}
        openAlertsCount={openMyAlerts.length}
        distressedCount={distressedMine}
        adverseCount={adverseMine}
      />

      {shipId ? (
        <FleetPlaybackBar
          connected={connected}
          snapshots={playback}
          requestPlayback={requestPlayback}
          liveShipCount={ships.length}
          scrubIndex={timelineIdx}
          onScrubIndexChange={setTimelineIdx}
        />
      ) : null}

      <CommandAlertsFeed
        alerts={shipId ? allAlerts : []}
        openAlertsCount={shipId ? openMyAlerts.length : 0}
        onAcknowledgeAlert={acknowledge}
        filterShipId={shipId}
        allowAcknowledge={false}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="order-2 min-w-0 lg:order-1">
            <CommandLeftSidebar
              ships={rosterShips}
              selectedId={shipId}
              onSelectShip={() => undefined}
            />
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <CommandMapPanel
              bbox={bbox}
              ships={mapShips}
              zones={mapZones}
              selectedId={shipId}
              drawMode={false}
              draftRing={[]}
              followSelected={true}
              onPickShip={() => undefined}
              onMapClick={() => undefined}
              onToggleFollow={() => undefined}
              replayHint={
                timelineIdx != null && snapshotTime
                  ? `History · ${new Date(snapshotTime).toLocaleTimeString()}`
                  : null
              }
            />
          </div>
        </div>

        <RestrictedZonesPanel
          drawMode={false}
          draftRing={[]}
          currentZones={mapZones}
          onToggleDrawMode={() => undefined}
          onPublishZone={() => undefined}
          onClearDraftRing={() => undefined}
          onRequestDeleteZone={() => undefined}
          zoneManagementEnabled={false}
        />

        <div className="min-w-0">
          <CommandRightSidebar
            variant="captain"
            selShip={myShip}
            directiveKind={directiveKind}
            selectedPortId={selectedPortId}
            wayLat={wayLat}
            wayLng={wayLng}
            ports={effectivePorts}
            onDirectiveKindChange={setDirectiveKind}
            onSelectedPortIdChange={setSelectedPortId}
            onWayLatChange={setWayLat}
            onWayLngChange={setWayLng}
            onIssueDirective={noopIssue}
            pendingDirectives={pendingDirectives}
            captainRespondMessage={captainMsg}
            onCaptainRespondMessageChange={setCaptainMsg}
            onCaptainRespondDirective={respond}
          />
        </div>
      </div>

      <CommandChatFab />
      </div>
    </div>
  );
}

export default function CaptainPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-600">
          Loading…
        </div>
      }
    >
      <CaptainBridgeInner />
    </Suspense>
  );
}
