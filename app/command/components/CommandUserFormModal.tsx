"use client";

import { FleetModal } from "./FleetModal";
import type { AppRole } from "@/app/lib/auth";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export type ManagedUserRow = {
  user_id: string;
  username: string;
  role: AppRole;
  ship_id: string | null;
  display_name: string;
  created_at: number;
};

type ShipOption = { ship_id: string; name: string };

type CommandUserFormModalProps = {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  user: ManagedUserRow | null;
  ships: ShipOption[];
  onSubmit: (payload: {
    displayName: string;
    username: string;
    password: string;
    role: AppRole;
    shipId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export function CommandUserFormModal({
  open,
  onClose,
  mode,
  user,
  ships,
  onSubmit,
}: CommandUserFormModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("captain");
  const [shipId, setShipId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && user) {
      setDisplayName(user.display_name);
      setUsername(user.username);
      setPassword("");
      setRole(user.role);
      setShipId(user.ship_id ?? "");
    } else {
      setDisplayName("");
      setUsername("");
      setPassword("");
      setRole("captain");
      setShipId(ships[0]?.ship_id ?? "");
    }
  }, [open, mode, user, ships]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "create" && !password.trim()) {
        setError("Password is required for new users.");
        toast.error("Password is required for new users.");
        setPending(false);
        return;
      }
      const res = await onSubmit({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        password,
        role,
        shipId: role === "captain" ? shipId : "",
      });
      if (!res.ok) {
        const msg = res.error ?? "Something went wrong.";
        setError(msg);
        toast.error(msg);
        return;
      }
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <FleetModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create user" : "Edit user"}
      description={
        mode === "create"
          ? "Add an operator with command or captain access."
          : "Update profile, role, and credentials."
      }
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="command-user-form"
            disabled={pending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </div>
      }
    >
      <form id="command-user-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Username (email or id)</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Password {mode === "edit" ? "(leave blank to keep current)" : ""}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            required={mode === "create"}
            autoComplete={mode === "create" ? "new-password" : "new-password"}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="command">Fleet command</option>
            <option value="captain">Captain</option>
          </select>
        </label>

        {role === "captain" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Assigned ship</span>
            <select
              value={shipId}
              onChange={(e) => setShipId(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Unassigned</option>
              {ships.map((s) => (
                <option key={s.ship_id} value={s.ship_id}>
                  {s.name} ({s.ship_id})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </form>
    </FleetModal>
  );
}
