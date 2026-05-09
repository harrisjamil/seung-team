"use client";

import type { ReactNode } from "react";
import { FleetModal } from "./FleetModal";

type FleetConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "neutral";
  onConfirm: () => void;
  loading?: boolean;
};

export function FleetConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  loading = false,
}: FleetConfirmModalProps) {
  return (
    <FleetModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${
              variant === "danger"
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm text-slate-700">{message}</div>
    </FleetModal>
  );
}
