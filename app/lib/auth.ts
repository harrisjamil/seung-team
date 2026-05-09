export type AppRole = "command" | "captain";

export type AppSession = {
  userId: string;
  username: string;
  role: AppRole;
  shipId?: string;
  displayName: string;
};

const KEY = "fleet-auth-session";

export function getSession(): AppSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppSession;
    if (parsed?.role === "command" || parsed?.role === "captain") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function setSession(session: AppSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
