"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type {
  FleetShipRuntime,
  HistorySnapshot,
  Role,
  SimStatePayload,
} from "./sim-types";
import { haversineKm, moveToward, type LatLng } from "./geo-client";

function wsUrl(): string {
  if (typeof window === "undefined") return "";
  const env = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (env) return env;
  const host = window.location.hostname;
  const port = process.env.NEXT_PUBLIC_WS_PORT?.trim();
  /**
   * http://localhost or LAN → talk to dev simulator on :8080.
   * https:// (Vercel, Render, …) → cannot guess the fleet sim host; set NEXT_PUBLIC_WS_URL to the
   * separate wss:// URL where server/ is deployed (same codebase, different service).
   */
  if (window.location.protocol === "https:") {
    if (port) return `wss://${host}:${port}`;
    return "";
  }
  return `ws://${host}:${port ?? "8080"}`;
}

export function useFleetWs(opts: { role: Role; shipId?: string }) {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<SimStatePayload | null>(null);
  const [displayShips, setDisplayShips] = useState<FleetShipRuntime[]>([]);
  const [bbox, setBbox] = useState<{
    south: number;
    west: number;
    north: number;
    east: number;
  } | null>(null);
  const [ports, setPorts] = useState<Record<
    string,
    { name: string; lat: number; lng: number }
  > | null>(null);
  const [playback, setPlayback] = useState<HistorySnapshot[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const closedByUnmountRef = useRef(false);
  const shipsRenderRef = useRef<Map<string, LatLng>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastVisualUpdateRef = useRef<number>(0);
  const latestRef = useRef<SimStatePayload | null>(null);

  const send = useCallback((msg: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    latestRef.current = latest;
  }, [latest]);

  useEffect(() => {
    const url = wsUrl();
    if (!url) return;
    closedByUnmountRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (closedByUnmountRef.current) return;
      clearReconnectTimer();
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(5000, 500 + attempt * 400);
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    const connect = () => {
      if (closedByUnmountRef.current) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: "auth",
            role: opts.role,
            shipId: opts.shipId ?? undefined,
          }),
        );
      });
      ws.addEventListener("close", () => {
        setConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      });
      ws.addEventListener("error", () => {
        ws.close();
      });
      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            message?: string;
            data?: SimStatePayload;
            bbox?: {
              south: number;
              west: number;
              north: number;
              east: number;
            };
            ports?: Record<string, { name: string; lat: number; lng: number }>;
          };
          if (msg.type === "error" && msg.message) {
            toast.error(String(msg.message));
          }
          if (msg.type === "hello") {
            if (msg.bbox) setBbox(msg.bbox);
            if (msg.ports) setPorts(msg.ports);
          }
          if (msg.type === "state" && msg.data) {
            msg.data.ships.forEach((sh) => {
              const sr = shipsRenderRef.current.get(sh.id);
              if (sr && haversineKm(sr, sh.position) > 8) {
                shipsRenderRef.current.set(sh.id, sh.position);
              }
            });
            setLatest(msg.data);
            const now = Date.now();
            if (now - lastVisualUpdateRef.current > 800) {
              const direct = msg.data.ships.map((s) => ({
                ...s,
                position: { lat: s.position.lat, lng: s.position.lng },
              }));
              setDisplayShips(direct);
              for (const s of direct) {
                shipsRenderRef.current.set(s.id, s.position);
              }
              lastVisualUpdateRef.current = now;
            }
          }
          if (msg.type === "playback") {
            const snaps = (msg as { snapshots?: HistorySnapshot[] }).snapshots;
            if (Array.isArray(snaps)) setPlayback(snaps);
          }
        } catch {
          /* ignore malformed */
        }
      });
    };

    connect();

    return () => {
      closedByUnmountRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [opts.role, opts.shipId]);

  /** Smooth extrapolation driven by RAF toward latest authoritative positions */
  useEffect(() => {
    const loop = (ts: number) => {
      const state = latestRef.current;
      if (state?.ships?.length) {
        const lastTs = lastFrameRef.current || ts;
        lastFrameRef.current = ts;
        const dt = Math.min(0.25, Math.max(0, (ts - lastTs) / 1000));
        const nextDisplay: FleetShipRuntime[] = state.ships.map((sh) => {
          let cur =
            shipsRenderRef.current.get(sh.id) ??
            ({ lat: sh.position.lat, lng: sh.position.lng } satisfies LatLng);
          const spd = Math.max(0, sh.speedKnots);
          const maxNmPerSec = spd / 3600;
          const maxKm = maxNmPerSec * 1.852 * dt;
          if (haversineKm(cur, sh.position) > 6) cur = sh.position;
          cur = moveToward(cur, sh.position, maxKm + 2e-3);
          shipsRenderRef.current.set(sh.id, cur);
          return { ...sh, position: { lat: cur.lat, lng: cur.lng } };
        });
        setDisplayShips(nextDisplay);
        lastVisualUpdateRef.current = Date.now();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const requestPlayback = useCallback(() => {
    send({ type: "playback.request" });
  }, [send]);

  return {
    connected,
    latest,
    displayShips,
    bbox,
    ports,
    playback,
    requestPlayback,
    send,
  };
}
