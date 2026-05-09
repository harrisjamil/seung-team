"use client";

import { FleetPageLoader } from "@/app/components/FleetPageLoader";
import { getSession, type AppSession } from "@/app/lib/auth";
import type { FleetShipRuntime } from "@/lib/sim-types";
import { useFleetWs } from "@/lib/useFleetWs";
import { faPlus, faPen, faShip, faTowerBroadcast, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FLEET_CONTENT_PAD, FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import { CommandHeader } from "../components/CommandHeader";
import { CommandSubpagePanel } from "../components/CommandSubpagePanel";
import { ShipDeleteModal } from "../components/ShipDeleteModal";
import { ShipFormModal } from "../components/ShipFormModal";

export default function CommandShipsPage() {
  const router = useRouter();
  const { connected, latest, ports, send } = useFleetWs({ role: "command" });
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingShip, setEditingShip] = useState<FleetShipRuntime | null>(null);
  const [deletingShip, setDeletingShip] = useState<FleetShipRuntime | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "command") {
      router.replace("/");
    }
    window.queueMicrotask(() => {
      setSession(s ?? null);
      setClientReady(true);
    });
  }, [router]);

  const ships = latest?.ships ?? [];

  const stats = useMemo(() => {
    const list = latest?.ships ?? [];
    return {
      count: list.length,
      adverse: list.filter((s) => s.weatherAdverse).length,
      distressed: list.filter((s) => s.status === "distressed").length,
    };
  }, [latest?.ships]);

  const openCreate = useCallback(() => {
    setEditingShip(null);
    setFormMode("create");
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((s: FleetShipRuntime) => {
    setEditingShip(s);
    setFormMode("edit");
    setFormOpen(true);
  }, []);

  if (!clientReady || !session || session.role !== "command") {
    return (
      <FleetPageLoader message={!clientReady || !session ? "Loading…" : "Redirecting…"} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <CommandHeader
        connected={connected}
        openAlertsCount={0}
        distressedCount={stats.distressed}
        adverseCount={stats.adverse}
        router={router}
      />

      <div className={FLEET_CONTENT_PAD}>
      <CommandSubpagePanel
        icon={faShip}
        title="Fleet ships"
        subtitle="Create, edit, and remove vessels — changes sync to the simulator and fleet file"
        badges={[
          { label: `${stats.count} vessels`, icon: faShip },
          { label: connected ? "Simulator online" : "Connecting…", icon: faTowerBroadcast },
        ]}
        headerAside={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-800"
          >
            <FontAwesomeIcon icon={faPlus} />
            Add vessel
          </button>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hide-scrollbar overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Fuel (t)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ships.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No vessels loaded yet — check the simulator connection.
                    </td>
                  </tr>
                ) : (
                  ships.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs text-slate-800">{s.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{s.status}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {s.position.lat.toFixed(4)}, {s.position.lng.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.destinationPortName}</td>
                      <td className="px-4 py-3 tabular-nums">{s.fuelTonnes.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="mr-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          <FontAwesomeIcon icon={faPen} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingShip(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CommandSubpagePanel>

      <ShipFormModal
        open={formOpen}
        mode={formMode}
        ship={formMode === "edit" ? editingShip : null}
        ports={ports}
        onClose={() => {
          setFormOpen(false);
          setEditingShip(null);
        }}
        onSubmit={(payload) => {
          if (payload.mode === "create" && payload.ship) {
            send({ type: "ship.create", ship: payload.ship });
          }
          if (payload.mode === "edit" && payload.shipId && payload.patch) {
            send({ type: "ship.update", shipId: payload.shipId, patch: payload.patch });
          }
          setFormOpen(false);
          setEditingShip(null);
        }}
      />

      <ShipDeleteModal
        ship={deletingShip}
        onCancel={() => setDeletingShip(null)}
        onConfirm={(id) => {
          send({ type: "ship.delete", shipId: id });
          setDeletingShip(null);
        }}
      />
      </div>
    </div>
  );
}
