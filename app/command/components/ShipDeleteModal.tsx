"use client";

import { AppModal } from "@/components/AppModal";
import type { FleetShipRuntime } from "@/lib/sim-types";

export function ShipDeleteModal({
  ship,
  onCancel,
  onConfirm,
}: {
  ship: FleetShipRuntime | null;
  onCancel: () => void;
  onConfirm: (shipId: string) => void;
}) {
  return (
    <AppModal
      open={!!ship}
      title="Remove vessel?"
      description={
        ship
          ? `Permanently remove “${ship.name}” (${ship.id}) from the fleet. This updates the fleet file and database.`
          : undefined
      }
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ship}
            onClick={() => ship && onConfirm(ship.id)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            Delete vessel
          </button>
        </div>
      }
    />
  );
}
