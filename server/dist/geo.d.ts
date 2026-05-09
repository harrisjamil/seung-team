import type { GeoJSONPolygon, LatLng } from "./types.js";
/** Ray casting; ring vertices are [lng, lat]. Duplicate closure point is tolerated. */
export declare function pointInRingLngLat(ring: [number, number][], lng: number, lat: number): boolean;
export declare function haversineKm(a: LatLng, b: LatLng): number;
export declare function nmFromKm(km: number): number;
export declare function kmFromNm(nm: number): number;
export declare function normalizeHeading(deg: number): number;
export declare function bearingDegrees(from: LatLng, to: LatLng): number;
export declare function segmentsIntersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean;
export declare function pointInPolygon(poly: GeoJSONPolygon, lng: number, lat: number): boolean;
export declare function pointInsideAnyZone(lng: number, lat: number, zones: {
    ring: [number, number][];
}[]): boolean;
export declare function segmentCrossesRestrictedRing(a: LatLng, b: LatLng, ring: [number, number][]): boolean;
export declare function latLngToward(from: LatLng, to: LatLng, nm: number): LatLng;
