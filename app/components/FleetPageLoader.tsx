"use client";

import { Loader2 } from "lucide-react";

type FleetPageLoaderProps = {
  message?: string;
  /** Tighter layout when embedded inside a card */
  variant?: "screen" | "inline";
};

/**
 * Animated loader aligned with command fleet pages (slate gradient, spin icon).
 */
export function FleetPageLoader({
  message = "Loading…",
  variant = "screen",
}: FleetPageLoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2
          className="h-8 w-8 shrink-0 animate-spin text-slate-900 dark:text-slate-100"
          strokeWidth={2.25}
        />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100 lg:p-6">
      <Loader2 className="h-11 w-11 shrink-0 animate-spin" strokeWidth={2.25} />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
}
