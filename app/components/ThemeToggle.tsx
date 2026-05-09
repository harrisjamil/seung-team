"use client";

import { useFleetTheme } from "@/app/lib/theme";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useFleetTheme();

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-amber-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700 ${className}`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} className="text-base" />
    </button>
  );
}
