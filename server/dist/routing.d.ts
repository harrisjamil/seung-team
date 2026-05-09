import type { FleetJson, LatLng, RestrictedZone } from "./types.js";
export interface RouteComputeResult {
    waypoints: LatLng[];
    pathNm: number;
    unreachable: boolean;
}
export declare function computeRoute(fleet: FleetJson, zones: RestrictedZone[], start: LatLng, goal: LatLng, stepDeg: number): RouteComputeResult;
