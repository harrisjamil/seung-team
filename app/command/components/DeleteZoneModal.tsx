export function DeleteZoneModal({
  zone,
  onCancel,
  onConfirm,
}: {
  zone: { id: string; name: string } | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  if (!zone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">Delete restricted zone?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-900">{zone.name}</span>? This
          will remove the zone for all connected users.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(zone.id)}
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Delete zone
          </button>
        </div>
      </div>
    </div>
  );
}
