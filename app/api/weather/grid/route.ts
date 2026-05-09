import { NextResponse } from "next/server";

type Cell = {
  lat: number;
  lng: number;
  /** 0 = calm, 1 = elevated conditions, 2 = adverse (matches severe sim thresholds) */
  level: 0 | 1 | 2;
  adverse: boolean;
  windMps: number;
  gustMps: number;
};

const CACHE_MS = 90_000;
const mem = new Map<string, { at: number; cell: Omit<Cell, "lat" | "lng"> }>();

function key(lat: number, lng: number) {
  return `v2_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

function classifyAdverse(windMps: number, gustMps: number) {
  return windMps >= 12 || gustMps >= 18;
}

/** Looser display tier so the map shows useful context when it is not yet “severe”. */
function classifyLevel(windMps: number, gustMps: number): 0 | 1 | 2 {
  if (classifyAdverse(windMps, gustMps)) return 2;
  if (windMps >= 8 || gustMps >= 12) return 1;
  return 0;
}

async function fetchCell(lat: number, lng: number): Promise<Omit<Cell, "lat" | "lng">> {
  const k = key(lat, lng);
  const now = Date.now();
  const hit = mem.get(k);
  if (hit && now - hit.at < CACHE_MS) return hit.cell;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("wind_speed_unit", "ms");

  let windMps = 0;
  let gustMps = 0;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (res.ok) {
      const data = (await res.json()) as {
        current?: { wind_speed_10m?: number; wind_gusts_10m?: number };
      };
      windMps = data.current?.wind_speed_10m ?? 0;
      gustMps = data.current?.wind_gusts_10m ?? windMps;
    }
  } catch {
    /* keep zeros */
  }

  const adverse = classifyAdverse(windMps, gustMps);
  const level = classifyLevel(windMps, gustMps);
  const cell = { adverse, level, windMps, gustMps };
  mem.set(k, { at: now, cell });
  return cell;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const south = Number(searchParams.get("south"));
  const west = Number(searchParams.get("west"));
  const north = Number(searchParams.get("north"));
  const east = Number(searchParams.get("east"));
  if (
    ![south, west, north, east].every((n) => Number.isFinite(n)) ||
    south >= north ||
    west >= east
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing south, west, north, east." },
      { status: 400 },
    );
  }

  const cols = Math.min(8, Math.max(3, Number(searchParams.get("cols")) || 6));
  const rows = Math.min(8, Math.max(3, Number(searchParams.get("rows")) || 6));

  const tasks: Promise<Cell>[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = south + ((north - south) * (r + 0.5)) / rows;
      const lng = west + ((east - west) * (c + 0.5)) / cols;
      tasks.push(
        fetchCell(lat, lng).then((cell) => ({
          lat,
          lng,
          ...cell,
        })),
      );
    }
  }

  const CHUNK = 6;
  const cells: Cell[] = [];
  for (let i = 0; i < tasks.length; i += CHUNK) {
    const chunk = await Promise.all(tasks.slice(i, i + CHUNK));
    cells.push(...chunk);
  }

  const geojson = {
    type: "FeatureCollection" as const,
    features: cells.map((cell) => ({
      type: "Feature" as const,
      properties: {
        level: cell.level,
        adverse: cell.adverse,
        windMps: cell.windMps,
        gustMps: cell.gustMps,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [cell.lng, cell.lat],
      },
    })),
  };

  return NextResponse.json(
    {
      ok: true,
      generatedAt: Date.now(),
      thresholds: {
        adverse: { windMps: 12, gustMps: 18 },
        elevated: { windMps: 8, gustMps: 12 },
      },
      geojson,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
