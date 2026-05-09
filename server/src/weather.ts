/** Open-Meteo free API (no key). Assumptions documented in repo README. */

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
  return hit.adverse ? 1.15 : 1;
}

export function primeWeatherCache(): void {
  void cache;
}
