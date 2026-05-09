"use client";

import { useFleetTheme } from "@/app/lib/theme";
import { Toaster } from "react-hot-toast";

export function AppToaster() {
  const { theme } = useFleetTheme();
  const isDark = theme === "dark";

  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: "3.25rem" }}
      gutter={10}
      toastOptions={{
        duration: 3800,
        style: {
          background: isDark ? "#1e293b" : "#fff",
          color: isDark ? "#f1f5f9" : "#0f172a",
          border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 10px 40px rgba(0, 0, 0, 0.45)"
            : "0 10px 40px rgba(15, 23, 42, 0.12)",
          padding: "12px 16px",
          fontSize: "14px",
          maxWidth: "min(420px, calc(100vw - 32px))",
        },
        success: {
          iconTheme: {
            primary: isDark ? "#34d399" : "#059669",
            secondary: isDark ? "#0f172a" : "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#f43f5e",
            secondary: isDark ? "#0f172a" : "#fff",
          },
        },
      }}
    />
  );
}
