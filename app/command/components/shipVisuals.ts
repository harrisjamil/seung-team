import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxes,
  faCar,
  faFlask,
  faGasPump,
  faIndustry,
  faShip,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import type { FleetShipRuntime } from "@/lib/sim-types";

export function shipTypeVisual(ship: FleetShipRuntime): {
  icon: IconDefinition;
  accentClass: string;
} {
  const cargoType = String(
    (ship.cargo as { type?: unknown })?.type ?? "",
  ).toLowerCase();
  if (cargoType.includes("container")) {
    return { icon: faBoxes, accentClass: "text-sky-600" };
  }
  if (cargoType.includes("vehicle")) {
    return { icon: faCar, accentClass: "text-violet-600" };
  }
  if (
    cargoType.includes("lng") ||
    cargoType.includes("refined") ||
    cargoType.includes("fuel")
  ) {
    return { icon: faGasPump, accentClass: "text-amber-600" };
  }
  if (cargoType.includes("chemical")) {
    return { icon: faFlask, accentClass: "text-rose-600" };
  }
  if (cargoType.includes("refrigerated")) {
    return { icon: faSnowflake, accentClass: "text-cyan-600" };
  }
  if (
    cargoType.includes("bulk") ||
    cargoType.includes("coal") ||
    cargoType.includes("steel")
  ) {
    return { icon: faIndustry, accentClass: "text-slate-700" };
  }
  return { icon: faShip, accentClass: "text-slate-600" };
}
