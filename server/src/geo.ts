import type { GeoJSONPolygon, LatLng } from "./types.js";

const EARTH_R_KM = 6371;

/** Ray casting; ring vertices are [lng, lat]. Duplicate closure point is tolerated. */
export function pointInRingLngLat(ring: [number, number][], lng: number, lat: number): boolean {
  let pts = [...ring];
  if (
    pts.length > 3 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1]
  ) {
    pts = pts.slice(0, -1);
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return EARTH_R_KM * c;
}

export function nmFromKm(km: number): number {
  return km / 1.852;
}

export function kmFromNm(nm: number): number {
  return nm * 1.852;
}

export function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return normalizeHeading((θ * 180) / Math.PI);
}

export function segmentsIntersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean {
  function orient(p: LatLng, q: LatLng, r: LatLng) {
    const v =
      (q.lat - p.lat) * (r.lng - q.lng) -
      (q.lng - p.lng) * (r.lat - q.lat);
    if (Math.abs(v) < 1e-12) return 0;
    return v > 0 ? 1 : 2;
  }
  function onSeg(p: LatLng, q: LatLng, r: LatLng) {
    return (
      q.lat <= Math.max(p.lat, r.lat) + 1e-9 &&
      q.lat >= Math.min(p.lat, r.lat) - 1e-9 &&
      q.lng <= Math.max(p.lng, r.lng) + 1e-9 &&
      q.lng >= Math.min(p.lng, r.lng) - 1e-9
    );
  }
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a1, b1, a2)) return true;
  if (o2 === 0 && onSeg(a1, b2, a2)) return true;
  if (o3 === 0 && onSeg(b1, a1, b2)) return true;
  if (o4 === 0 && onSeg(b1, a2, b2)) return true;
  return false;
}

export function pointInPolygon(poly: GeoJSONPolygon, lng: number, lat: number): boolean {
  const outer = poly.coordinates[0] as [number, number][];
  let ok = pointInRingLngLat(outer, lng, lat);
  for (let i = 1; i < poly.coordinates.length; i++) {
    const hole = poly.coordinates[i] as [number, number][];
    if (pointInRingLngLat(hole, lng, lat)) ok = false;
  }
  return ok;
}

export function pointInsideAnyZone(
  lng: number,
  lat: number,
  zones: { ring: [number, number][] }[],
): boolean {
  return zones.some((z) => pointInRingLngLat(z.ring, lng, lat));
}

export function segmentCrossesRestrictedRing(
  a: LatLng,
  b: LatLng,
  ring: [number, number][],
): boolean {
  if (ring.length < 3) return false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [lngA, latA] = ring[i];
    const [lngB, latB] = ring[(i + 1) % n];
    if (segmentsIntersect(a, b, { lat: latA, lng: lngA }, { lat: latB, lng: lngB })) {
      return true;
    }
  }
  return false;
}

export function latLngToward(from: LatLng, to: LatLng, nm: number): LatLng {
  const dKm = nmFromKm(haversineKm(from, to));
  const distKm = nm * 1.852;
  const t = Math.min(1, distKm / Math.max(dKm, 1e-6));
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}
