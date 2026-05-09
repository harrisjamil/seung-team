"use client";

import { AppModal } from "@/components/AppModal";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useEffect, useState } from "react";

type PortMap = Record<string, { name: string; lat: number; lng: number }>;

function emptyCreateDefaults(ports: PortMap | null): {
  id: string;
  name: string;
  lat: string;
  lng: string;
  headingDeg: string;
  speedKnots: string;
  destinationPortId: string;
  fuelTonnes: string;
  fuelBurnTonnesPerNm: string;
} {
  const firstPort = ports ? Object.keys(ports)[0] ?? "" : "";
  return {
    id: "",
    name: "",
    lat: "25.2",
    lng: "55.3",
    headingDeg: "90",
    speedKnots: "12",
    destinationPortId: firstPort,
    fuelTonnes: "400",
    fuelBurnTonnesPerNm: "0.045",
  };
}

export function ShipFormModal({
  open,
  mode,
  ship,
  ports,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  ship: FleetShipRuntime | null;
  ports: PortMap | null;
  onClose: () => void;
  onSubmit: (payload: {
    mode: "create" | "edit";
    shipId?: string;
    ship?: Record<string, unknown>;
    patch?: Record<string, unknown>;
  }) => void;
}) {
  const [form, setForm] = useState(() => emptyCreateDefaults(null));

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && ship) {
      setForm({
        id: ship.id,
        name: ship.name,
        lat: String(ship.position.lat),
        lng: String(ship.position.lng),
        headingDeg: String(ship.headingDeg),
        speedKnots: String(ship.speedKnots),
        destinationPortId: ship.destinationPortId,
        fuelTonnes: String(ship.fuelTonnes),
        fuelBurnTonnesPerNm: String(ship.fuelBurnTonnesPerNm),
      });
    } else {
      setForm(emptyCreateDefaults(ports));
    }
  }, [open, mode, ship, ports]);

  const portEntries = ports ? Object.entries(ports) : [];

  const handleSave = () => {
    if (mode === "create") {
      const id = form.id.trim();
      const name = form.name.trim();
      if (!id || !name) return;
      onSubmit({
        mode: "create",
        ship: {
          id,
          name,
          lat: Number(form.lat),
          lng: Number(form.lng),
          headingDeg: Number(form.headingDeg),
          speedKnots: Number(form.speedKnots),
          destinationPortId: form.destinationPortId,
          fuelTonnes: Number(form.fuelTonnes),
          fuelBurnTonnesPerNm: Number(form.fuelBurnTonnesPerNm),
          cargo: {},
        },
      });
      return;
    }
    if (!ship) return;
    onSubmit({
      mode: "edit",
      shipId: ship.id,
      patch: {
        name: form.name.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        headingDeg: Number(form.headingDeg),
        speedKnots: Number(form.speedKnots),
        destinationPortId: form.destinationPortId,
        fuelTonnes: Number(form.fuelTonnes),
        fuelBurnTonnesPerNm: Number(form.fuelBurnTonnesPerNm),
      },
    });
  };

  const valid =
    portEntries.length > 0 &&
    form.name.trim() &&
    (mode === "edit" || form.id.trim()) &&
    Number.isFinite(Number(form.lat)) &&
    Number.isFinite(Number(form.lng)) &&
    !!form.destinationPortId;

  return (
    <AppModal
      open={open}
      title={mode === "create" ? "Add vessel" : "Edit vessel"}
      description="Coordinates must fall inside navigable water. Destination must be a fleet port."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={handleSave}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
          >
            {mode === "create" ? "Create vessel" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "create" ? (
          <label className="flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Ship ID
            </span>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="e.g. BRV-200"
              autoComplete="off"
            />
          </label>
        ) : (
          <div className="sm:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Ship ID
            </span>
            <p className="mt-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">
              {form.id}
            </p>
          </div>
        )}
        <label className="flex flex-col gap-1 sm:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Vessel name"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Latitude
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Longitude
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Heading (°)
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.headingDeg}
            onChange={(e) => setForm((f) => ({ ...f, headingDeg: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Speed (kn)
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.speedKnots}
            onChange={(e) => setForm((f) => ({ ...f, speedKnots: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Destination port
          </span>
          {portEntries.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Waiting for port list from the simulator…
            </p>
          ) : (
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
              value={form.destinationPortId}
              onChange={(e) => setForm((f) => ({ ...f, destinationPortId: e.target.value }))}
            >
              {portEntries.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name} ({id})
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Fuel (t)
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.fuelTonnes}
            onChange={(e) => setForm((f) => ({ ...f, fuelTonnes: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Burn (t/nm)
          </span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.fuelBurnTonnesPerNm}
            onChange={(e) => setForm((f) => ({ ...f, fuelBurnTonnesPerNm: e.target.value }))}
          />
        </label>
      </div>
    </AppModal>
  );
}
