/** Open-Meteo free API (no key). Assumptions documented in repo README. */

import { haversineKm, nmFromKm } from "./geo.js";
import type { LatLng } from "./types.js";

/** Extra fuel consumption when transiting adverse weather (+30%). */
export const ADVERSE_FUEL_MULTIPLIER = 1.3;

/**
 * A* routing cost multiplier over cells with adverse conditions (discourage bad weather).
 * Higher than burn multiplier so paths detour before paying fuel on that track.
 */
export const ROUTING_ADVERSE_COST_MULTIPLIER = 1.35;

export type WeatherSnapshot = {
  adverse: boolean;
  windMps: number;
  gustMps: number;
  fetchedAt: number;
};

const cache = new Map<string, WeatherSnapshot>();
const CACHE_MS = 120_000;

function key(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

/** Assumption: adverse if sustained wind ≥ 12 m/s or gusts ≥ 18 m/s (adjust in README). */
export function classifyAdverse(windMps: number, gustMps: number): boolean {
  return windMps >= 12 || gustMps >= 18;
}

export async function fetchWeatherAt(lat: number, lng: number): Promise<WeatherSnapshot> {
  const k = key(lat, lng);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && now - hit.fetchedAt < CACHE_MS) return hit;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("wind_speed_unit", "ms");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = (await res.json()) as {
      current?: { wind_speed_10m?: number; wind_gusts_10m?: number };
    };
    const windMps = data.current?.wind_speed_10m ?? 0;
    const gustMps = data.current?.wind_gusts_10m ?? windMps;
    const snap: WeatherSnapshot = {
      windMps,
      gustMps,
      adverse: classifyAdverse(windMps, gustMps),
      fetchedAt: now,
    };
    cache.set(k, snap);
    return snap;
  } catch {
    const fallback: WeatherSnapshot = {
      windMps: 0,
      gustMps: 0,
      adverse: false,
      fetchedAt: now,
    };
    cache.set(k, fallback);
    return fallback;
  } finally {
    clearTimeout(t);
  }
}

/** Interpolate risk 0..1 from cached samples (simple nearest). */
export function weatherCostMultiplierAt(lat: number, lng: number): number {
  const k = key(lat, lng);
  const hit = cache.get(k);
  if (!hit) return 1;
  return hit.adverse ? ROUTING_ADVERSE_COST_MULTIPLIER : 1;
}

/** Uses cached Open-Meteo samples (call {@link prefetchWeatherForRouting} before routing). */
export function isAdverseWeatherAt(lat: number, lng: number): boolean {
  return cache.get(key(lat, lng))?.adverse ?? false;
}

/** Sample points along the great-circle between start and goal so routing has cache hits. */
export async function prefetchWeatherForRouting(
  start: LatLng,
  goal: LatLng,
  /** ~ how many samples along the chord */
  segments = 14,
): Promise<void> {
  const samples: LatLng[] = [{ ...start }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    samples.push({
      lat: start.lat + (goal.lat - start.lat) * t,
      lng: start.lng + (goal.lng - start.lng) * t,
    });
  }
  samples.push({ ...goal });
  const unique = samples.filter(
    (p, i, a) => i === 0 || p.lat !== a[i - 1].lat || p.lng !== a[i - 1].lng,
  );
  const chunk = 5;
  for (let i = 0; i < unique.length; i += chunk) {
    const part = unique.slice(i, i + chunk);
    await Promise.all(part.map((p) => fetchWeatherAt(p.lat, p.lng)));
  }
}

/** Total path length and subset nautical miles in (cached) adverse conditions at segment midpoints. */
export function measureAdverseAlongWaypoints(waypoints: LatLng[]): {
  pathNm: number;
  insideAdverseNm: number;
} {
  if (waypoints.length < 2) return { pathNm: 0, insideAdverseNm: 0 };
  let pathNm = 0;
  let insideAdverseNm = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const nm = nmFromKm(haversineKm(a, b));
    pathNm += nm;
    const midLat = (a.lat + b.lat) / 2;
    const midLng = (a.lng + b.lng) / 2;
    if (isAdverseWeatherAt(midLat, midLng)) {
      insideAdverseNm += nm;
    }
  }
  return { pathNm, insideAdverseNm };
}

export function primeWeatherCache(): void {
  void cache;
}
