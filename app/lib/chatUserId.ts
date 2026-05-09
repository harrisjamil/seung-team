import { getSession } from "@/app/lib/auth";

const GUEST_KEY = "fleet-chat-guest-id";

/**
 * Stable id for chat history: logged-in user, or a persisted guest id before login.
 */
export function getChatUserId(): string {
  if (typeof window === "undefined") return "ssr";
  const session = getSession();
  if (session?.userId) return session.userId;
  let id = window.localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID()}`;
    window.localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}
