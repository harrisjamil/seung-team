import { bearingDegrees, haversineKm, nmFromKm, pointInPolygon, pointInRingLngLat } from "./geo.js";
import type { FleetJson, LatLng, RestrictedZone } from "./types.js";
import { weatherCostMultiplierAt } from "./weather.js";

export interface RouteComputeResult {
  waypoints: LatLng[];
  pathNm: number;
  unreachable: boolean;
}

function snapToGrid(
  v: number,
  origin: number,
  step: number,
  maxIdx: number,
): number {
  const idx = Math.round((v - origin) / step);
  return Math.max(0, Math.min(maxIdx, idx));
}

function idxToLatLng(
  cx: number,
  cy: number,
  south: number,
  west: number,
  step: number,
): LatLng {
  return {
    lat: south + cy * step + step / 2,
    lng: west + cx * step + step / 2,
  };
}

function isOpenCell(
  fleet: FleetJson,
  zones: RestrictedZone[],
  lat: number,
  lng: number,
): boolean {
  if (!pointInPolygon(fleet.navigableWater, lng, lat)) return false;
  for (const z of zones) {
    if (pointInRingLngLat(z.ring, lng, lat)) return false;
  }
  return true;
}

function nearestOpenCell(
  fleet: FleetJson,
  zones: RestrictedZone[],
  south: number,
  west: number,
  rows: number,
  cols: number,
  step: number,
  target: LatLng,
): { cx: number; cy: number } | null {
  const tcx = snapToGrid(target.lng, west, step, cols - 1);
  const tcy = snapToGrid(target.lat, south, step, rows - 1);
  const startCx = tcx;
  const startCy = tcy;

  const tryCell = (cx: number, cy: number) => {
    const ll = idxToLatLng(cx, cy, south, west, step);
    if (isOpenCell(fleet, zones, ll.lat, ll.lng)) return { cx, cy };
    return null;
  };

  const direct = tryCell(startCx, startCy);
  if (direct) return direct;

  const maxR = Math.max(rows, cols);
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) {
        const cx = startCx + dx;
        const cy = startCy + dy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const hit = tryCell(cx, cy);
        if (hit) return hit;
      }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (const dx of [-r, r]) {
        const cx = startCx + dx;
        const cy = startCy + dy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const hit = tryCell(cx, cy);
        if (hit) return hit;
      }
    }
  }
  return null;
}

type ONode = {
  cx: number;
  cy: number;
  g: number;
  f: number;
  parentKey: string | null;
};

const NEIGH: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

function shortestAngleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function simplifyPolyline(pts: LatLng[]): LatLng[] {
  if (pts.length <= 2) return pts;
  const out: LatLng[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const ab = bearingDegrees(a, b);
    const bc = bearingDegrees(b, c);
    if (Math.abs(shortestAngleDelta(ab, bc)) > 6) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function computeRoute(
  fleet: FleetJson,
  zones: RestrictedZone[],
  start: LatLng,
  goal: LatLng,
  stepDeg: number,
): RouteComputeResult {
  const { south, west, north, east } = fleet.bbox;
  const cols = Math.max(2, Math.ceil((east - west) / stepDeg));
  const rows = Math.max(2, Math.ceil((north - south) / stepDeg));

  const sCell = nearestOpenCell(fleet, zones, south, west, rows, cols, stepDeg, start);
  const gCell = nearestOpenCell(fleet, zones, south, west, rows, cols, stepDeg, goal);
  if (!sCell || !gCell) {
    return { waypoints: [], pathNm: 0, unreachable: true };
  }

  const goalLl = idxToLatLng(gCell.cx, gCell.cy, south, west, stepDeg);
  const heuristic = (cx: number, cy: number) =>
    nmFromKm(
      haversineKm(idxToLatLng(cx, cy, south, west, stepDeg), goalLl),
    );

  const open = new Map<string, ONode>();
  const closed = new Map<string, ONode>();
  const kfun = (cx: number, cy: number) => `${cx}:${cy}`;

  const startK = kfun(sCell.cx, sCell.cy);
  open.set(startK, {
    cx: sCell.cx,
    cy: sCell.cy,
    g: 0,
    f: heuristic(sCell.cx, sCell.cy),
    parentKey: null,
  });

  while (open.size > 0) {
    let bestK = "";
    let bestNode: ONode | null = null;
    for (const [kk, nn] of open) {
      if (!bestNode || nn.f < bestNode.f) {
        bestNode = nn;
        bestK = kk;
      }
    }
    if (!bestNode) break;
    open.delete(bestK);
    closed.set(bestK, bestNode);

    if (bestNode.cx === gCell.cx && bestNode.cy === gCell.cy) {
      const cells: { cx: number; cy: number }[] = [];
      let ck: string | null = bestK;
      while (ck) {
        const n = closed.get(ck);
        if (!n) break;
        cells.push({ cx: n.cx, cy: n.cy });
        ck = n.parentKey;
      }
      cells.reverse();
      const gridPts = cells.map((c) =>
        idxToLatLng(c.cx, c.cy, south, west, stepDeg),
      );

      /** Full chain: ship → grid path → precise port */
      const chain: LatLng[] = [{ ...start }, ...gridPts.slice(1), { ...goal }];
      const waypoints = simplifyPolyline(chain);
      let pathNm = 0;
      for (let i = 1; i < waypoints.length; i++) {
        pathNm += nmFromKm(haversineKm(waypoints[i - 1], waypoints[i]));
      }
      return { waypoints, pathNm, unreachable: false };
    }

    for (const [dx, dy, dn] of NEIGH) {
      const ncx = bestNode.cx + dx;
      const ncy = bestNode.cy + dy;
      if (ncx < 0 || ncy < 0 || ncx >= cols || ncy >= rows) continue;
      const cellCenter = idxToLatLng(ncx, ncy, south, west, stepDeg);
      if (!isOpenCell(fleet, zones, cellCenter.lat, cellCenter.lng)) continue;

      const fromCenter = idxToLatLng(bestNode.cx, bestNode.cy, south, west, stepDeg);
      const edgeKm = haversineKm(fromCenter, cellCenter);
      const edgeNm = nmFromKm(edgeKm);
      const mult =
        dn *
        weatherCostMultiplierAt(
          (fromCenter.lat + cellCenter.lat) / 2,
          (fromCenter.lng + cellCenter.lng) / 2,
        );
      const stepCost = edgeNm * mult;
      const g = bestNode.g + stepCost;
      const nk = kfun(ncx, ncy);
      if (closed.has(nk)) continue;
      const h = heuristic(ncx, ncy);
      const prev = open.get(nk);
      if (!prev || g < prev.g) {
        open.set(nk, {
          cx: ncx,
          cy: ncy,
          g,
          f: g + h,
          parentKey: bestK,
        });
      }
    }
  }

  return { waypoints: [], pathNm: 0, unreachable: true };
}
