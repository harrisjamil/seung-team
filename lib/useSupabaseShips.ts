"use client";

import useSWR from "swr";
import {
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL,
} from "@/lib/supabasePublicDefaults";
import type { FleetShipRuntime } from "./sim-types";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type SupabaseShipRow = {
  ship_id: string;
  name: string;
  lat: number;
  lng: number;
  speed_knots: number;
  heading_deg: number;
  destination_port_id: string;
  destination_port_name: string;
  fuel_tonnes: number;
  cargo: Record<string, unknown> | null;
  status: string;
  weather_adverse: boolean;
  fuel_required_remaining_tonnes: number | null;
  route: Array<{ lat?: number; lng?: number }> | null;
  route_meta: { pathNm?: number; insideAdverseNm?: number } | null;
};

const SHIP_SELECT_COLUMNS = [
  "ship_id",
  "name",
  "lat",
  "lng",
  "speed_knots",
  "heading_deg",
  "destination_port_id",
  "destination_port_name",
  "fuel_tonnes",
  "cargo",
  "status",
  "weather_adverse",
  "fuel_required_remaining_tonnes",
  "route",
  "route_meta",
].join(",");

function toRuntimeShip(row: SupabaseShipRow): FleetShipRuntime {
  const route = Array.isArray(row.route)
    ? row.route
        .map((p) => ({
          lat: Number(p?.lat),
          lng: Number(p?.lng),
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    : [];

  return {
    id: row.ship_id,
    name: row.name,
    position: { lat: row.lat, lng: row.lng },
    headingDeg: row.heading_deg,
    speedKnots: row.speed_knots,
    destinationPortId: row.destination_port_id,
    destinationPortName: row.destination_port_name,
    destinationPortPosition: route.at(-1) ?? { lat: row.lat, lng: row.lng },
    fuelTonnes: row.fuel_tonnes,
    fuelBurnTonnesPerNm: 0,
    cargo: row.cargo ?? {},
    status: row.status,
    route,
    maxReportedSpeedKnots: row.speed_knots,
    weatherAdverse: row.weather_adverse,
    fuelRequiredRemainingTonnes: row.fuel_required_remaining_tonnes,
    routeMeta: row.route_meta
      ? {
          pathNm: Number(row.route_meta.pathNm ?? 0),
          insideAdverseNm: Number(row.route_meta.insideAdverseNm ?? 0),
        }
      : null,
  };
}

async function fetchShips(): Promise<FleetShipRuntime[]> {
  try {
    if (SUPABASE_URL && SUPABASE_KEY) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/ships`);
      url.searchParams.set("select", SHIP_SELECT_COLUMNS);
      url.searchParams.set("order", "ship_id.asc");
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (res.ok) {
        const rows = (await res.json()) as SupabaseShipRow[];
        if (rows.length > 0) return rows.map(toRuntimeShip);
      }
    }

    // Keep demo usable even when Supabase ships table is empty.
    const seedRes = await fetch("/api/fleet/ships");
    if (!seedRes.ok) return [];
    const seedJson = (await seedRes.json()) as {
      ok: boolean;
      ships?: SupabaseShipRow[];
    };
    if (Array.isArray(seedJson.ships) && seedJson.ships.length > 0) {
      return seedJson.ships.map(toRuntimeShip);
    }
  } catch {
    // Network/CORS/transient errors should not break command page render.
  }
  return [];
}

export function useSupabaseShips(refreshMs = 5000) {
  const { data, isLoading } = useSWR<FleetShipRuntime[]>(
    "fleet-live-ships",
    fetchShips,
    {
      refreshInterval: refreshMs > 0 ? refreshMs : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    },
  );

  return { ships: data ?? [], loading: isLoading };
}
