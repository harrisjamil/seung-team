/** Minimal geodesic helpers for UI interpolation */

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x))));
}

/** Move from `current` toward `target`, at most `maxKm` kilometers. */
export function moveToward(current: LatLng, target: LatLng, maxKm: number): LatLng {
  const d = haversineKm(current, target);
  if (d < 5e-4) return { ...target };
  const t = Math.min(1, maxKm / d);
  return {
    lat: current.lat + (target.lat - current.lat) * t,
    lng: current.lng + (target.lng - current.lng) * t,
  };
}
