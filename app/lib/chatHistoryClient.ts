export type ChatHistoryRow = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export async function fetchChatHistory(userId: string, options?: { limit?: number; q?: string }) {
  const params = new URLSearchParams({ userId, limit: String(options?.limit ?? 80) });
  if (options?.q?.trim()) params.set("q", options.q.trim());
  const res = await fetch(`/api/chat/history?${params.toString()}`, {
    cache: "no-store",
  });
  const body = (await res.json()) as {
    ok: boolean;
    messages?: ChatHistoryRow[];
    error?: string;
  };
  if (!body.ok) throw new Error(body.error || "Failed to load chat history");
  return body.messages ?? [];
}

export async function appendChatMessages(
  userId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const res = await fetch("/api/chat/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, messages }),
  });
  const body = (await res.json()) as { ok: boolean; error?: string };
  if (!body.ok) throw new Error(body.error || "Failed to save chat history");
}
