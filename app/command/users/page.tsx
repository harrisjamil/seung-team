"use client";

import { FleetPageLoader } from "@/app/components/FleetPageLoader";
import { getSession, type AppRole, type AppSession } from "@/app/lib/auth";
import { faPen, faPlus, faTrash, faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import { CommandHeader } from "../components/CommandHeader";
import { CommandSubpagePanel } from "../components/CommandSubpagePanel";
import { CommandUserFormModal, type ManagedUserRow } from "../components/CommandUserFormModal";
import { FleetConfirmModal } from "../components/FleetConfirmModal";
import toast from "react-hot-toast";

type ShipOption = { ship_id: string; name: string };

function normalizeUserRow(raw: unknown): ManagedUserRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = o.user_id;
  const username = o.username;
  const role = o.role;
  const displayName = o.display_name;
  if (typeof userId !== "string" || typeof username !== "string" || typeof displayName !== "string") {
    return null;
  }
  if (role !== "command" && role !== "captain") return null;
  const shipId = o.ship_id == null ? null : String(o.ship_id);
  let createdMs = 0;
  const ca = o.created_at;
  if (typeof ca === "number" && Number.isFinite(ca)) createdMs = ca;
  else if (typeof ca === "string" && ca.trim() !== "") {
    const n = Number(ca);
    if (Number.isFinite(n)) createdMs = n;
  }
  return {
    user_id: userId,
    username,
    role,
    ship_id: shipId || null,
    display_name: displayName,
    created_at: createdMs,
  };
}

export default function CommandUsersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [users, setUsers] = useState<ManagedUserRow[]>([]);
  const [ships, setShips] = useState<ShipOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editUser, setEditUser] = useState<ManagedUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<ManagedUserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        fetch("/api/command/users", { cache: "no-store" }),
        fetch("/api/fleet/ships", { cache: "no-store" }),
      ]);
      const uJson = (await uRes.json()) as { ok?: boolean; users?: unknown[]; error?: string };
      const sJson = (await sRes.json()) as {
        ok?: boolean;
        ships?: Array<{ ship_id?: string; name?: string; id?: string }>;
        error?: string;
      };
      if (uRes.ok && uJson.ok && uJson.users) {
        setUsers(
          uJson.users.map((row) => normalizeUserRow(row)).filter((x): x is ManagedUserRow => x !== null),
        );
      } else {
        toast.error(uJson.error ?? "Couldn't load users.");
      }
      if (sRes.ok && sJson.ok && sJson.ships) {
        setShips(
          sJson.ships.map((x) => ({
            ship_id: x.ship_id ?? x.id ?? "",
            name: x.name ?? x.ship_id ?? "",
          })),
        );
      } else if (!sRes.ok) {
        toast.error(sJson.error ?? "Couldn't load fleet ships.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [session, load]);

  const openCreate = () => {
    setFormMode("create");
    setEditUser(null);
    setFormOpen(true);
  };

  const openEdit = (u: ManagedUserRow) => {
    setFormMode("edit");
    setEditUser(u);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: {
    displayName: string;
    username: string;
    password: string;
    role: AppRole;
    shipId: string;
  }) => {
    if (formMode === "create") {
      const res = await fetch("/api/command/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
          displayName: payload.displayName,
          role: payload.role,
          shipId: payload.role === "captain" ? payload.shipId || null : null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        return { ok: false as const, error: json.error ?? "Create failed." };
      }
      toast.success("User created.");
      await load();
      return { ok: true as const };
    }

    if (!editUser) {
      return { ok: false as const, error: "No user selected." };
    }

    const res = await fetch("/api/command/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editUser.user_id,
        username: payload.username,
        password: payload.password,
        displayName: payload.displayName,
        role: payload.role,
        shipId: payload.role === "captain" ? payload.shipId || null : null,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      return { ok: false as const, error: json.error ?? "Update failed." };
    }
    toast.success("User updated.");
    await load();
    return { ok: true as const };
  };

  const handleDelete = async () => {
    if (!deleteUser || !session) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/command/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: deleteUser.user_id,
          currentUserId: session.userId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Delete failed.");
        return;
      }
      toast.success("User removed.");
      setDeleteUser(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatCreated = (ms: number) => {
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return "—";
    }
  };

  if (!clientReady || !session || session.role !== "command") {
    return (
      <FleetPageLoader
        message={!clientReady || !session ? "Loading…" : "Redirecting…"}
      />
    );
  }

  return (
    <div className={FLEET_PAGE_SHELL}>
      <CommandHeader
        connected={false}
        openAlertsCount={0}
        distressedCount={0}
        adverseCount={0}
        router={router}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 sm:gap-6 sm:px-5 sm:py-5 lg:px-6">
        <CommandSubpagePanel
          icon={faUserGroup}
          title="User directory"
          subtitle="Create command and captain accounts, assign vessels, and keep credentials up to date."
          badges={
            loading
              ? undefined
              : [
                  { label: `${users.length} user${users.length === 1 ? "" : "s"}` },
                  { label: `${users.filter((u) => u.role === "command").length} command` },
                  { label: `${users.filter((u) => u.role === "captain").length} captain` },
                ]
          }
          headerAside={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[11px]" />
              New user
            </button>
          }
        >
          <div className="p-4 md:p-6">
            {loading ? (
              <FleetPageLoader variant="inline" message="Loading users…" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Display name
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Username
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Role
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Ship
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.user_id}
                        className="border-b border-slate-100 bg-white transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">{u.display_name}</td>
                        <td className="px-4 py-3 text-slate-700">{u.username}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              u.role === "command"
                                ? "border border-violet-200 bg-violet-50 text-violet-800"
                                : "border border-sky-200 bg-sky-50 text-sky-800"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {u.ship_id ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatCreated(u.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              <FontAwesomeIcon icon={faPen} className="text-[10px]" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteUser(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-100"
                            >
                              <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 ? (
                  <p className="bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No users yet. Create the first account with <strong>New user</strong>.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </CommandSubpagePanel>
      </div>

      <CommandUserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        user={formMode === "edit" ? editUser : null}
        ships={ships}
        onSubmit={handleFormSubmit}
      />

      <FleetConfirmModal
        open={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        title="Remove user"
        message={
          deleteUser ? (
            <>
              Permanently delete <strong>{deleteUser.display_name}</strong> ({deleteUser.username})?
              This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete user"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
