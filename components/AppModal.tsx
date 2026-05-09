"use client";

import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";

export function AppModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = "md",
  labelledById = "app-modal-title",
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  labelledById?: string;
}) {
  if (!open) return null;

  const maxW =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxW} max-h-[min(90vh,920px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={labelledById} className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-snug text-slate-600">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        {children ? <div className="max-h-[min(70vh,620px)] overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
