"use client";

import { getSession } from "@/app/lib/auth";
import { useCallback, useEffect, useState } from "react";

const EVENT = "fleet-dm-unread-refresh";

export function dispatchCommunicationUnreadRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function useCommunicationUnreadCount(): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const s = getSession();
    if (!s?.userId) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch(
        `/api/communication/unread-count?userId=${encodeURIComponent(s.userId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { ok?: boolean; count?: number };
      if (res.ok && json.ok && typeof json.count === "number") {
        setCount(json.count);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 12000);
    const onFocus = () => void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onCustom = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(EVENT, onCustom);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(EVENT, onCustom);
    };
  }, [refresh]);

  return { count, refresh };
}
