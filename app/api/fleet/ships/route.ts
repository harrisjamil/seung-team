import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

type FleetSeedShip = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speedKnots: number;
  headingDeg: number;
  destinationPortId: string;
  fuelTonnes: number;
  fuelBurnTonnesPerNm: number;
  cargo: Record<string, unknown>;
};

type FleetFile = {
  ports: Record<string, { name: string; lat: number; lng: number }>;
  ships: FleetSeedShip[];
};

export async function GET() {
  try {
    const fleetPath = join(process.cwd(), "fleet.json");
    const raw = await readFile(fleetPath, "utf8");
    const fleet = JSON.parse(raw) as FleetFile;
    const ships = (fleet.ships ?? []).map((s) => {
      const port = fleet.ports?.[s.destinationPortId];
      return {
        ship_id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        speed_knots: s.speedKnots,
        heading_deg: s.headingDeg,
        destination_port_id: s.destinationPortId,
        destination_port_name: port?.name ?? s.destinationPortId,
        fuel_tonnes: s.fuelTonnes,
        fuel_burn_tonnes_per_nm: s.fuelBurnTonnesPerNm,
        cargo: s.cargo ?? {},
        status: "normal",
        weather_adverse: false,
        fuel_required_remaining_tonnes: null,
        route: [],
        route_meta: null,
      };
    });
    return NextResponse.json({ ok: true, ships });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read fleet seeds",
      },
      { status: 500 },
    );
  }
}
