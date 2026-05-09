"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const FLEET_THEME_KEY = "fleet-theme";

export type FleetTheme = "light" | "dark";

export function applyThemeClass(theme: FleetTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

type ThemeCtx = {
  theme: FleetTheme;
  setTheme: (t: FleetTheme) => void;
  toggleTheme: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function FleetThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<FleetTheme>("light");

  /** Match class from {@link FleetThemeScript} on the document element. */
  useLayoutEffect(() => {
    setThemeState(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  const setTheme = useCallback((t: FleetTheme) => {
    setThemeState(t);
    applyThemeClass(t);
    try {
      localStorage.setItem(FLEET_THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: FleetTheme = prev === "dark" ? "light" : "dark";
      applyThemeClass(next);
      try {
        localStorage.setItem(FLEET_THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFleetTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useFleetTheme must be used within FleetThemeProvider");
  }
  return v;
}
