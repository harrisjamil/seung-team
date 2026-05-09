"use client";

import { AppModal } from "@/components/AppModal";

export function DeleteZoneModal({
  zone,
  onCancel,
  onConfirm,
}: {
  zone: { id: string; name: string } | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  return (
    <AppModal
      open={!!zone}
      title="Delete restricted zone?"
      description={
        zone
          ? `This will remove “${zone.name}” for all connected users.`
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
            disabled={!zone}
            onClick={() => zone && onConfirm(zone.id)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            Delete zone
          </button>
        </div>
      }
    />
  );
}
