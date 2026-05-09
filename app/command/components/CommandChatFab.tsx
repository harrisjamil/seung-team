"use client";

import { appendChatMessages, fetchChatHistory } from "@/app/lib/chatHistoryClient";
import { getChatUserId } from "@/app/lib/chatUserId";
import { Bot, ChevronUp, Search, Send, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type ChatMessage = { role: "user" | "assistant"; text: string; id?: number };

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Hi, I am Seung AI. Ask me anything about fleet operations.",
};

export function CommandChatFab() {
  const [scrollVisible, setScrollVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME]);

  const loadHistory = useCallback(async (q?: string, showFullLoader = true) => {
    const userId = getChatUserId();
    if (userId === "ssr") return;
    if (showFullLoader && !q) setHistoryLoading(true);
    try {
      const rows = await fetchChatHistory(userId, { q: q || undefined, limit: 100 });
      if (rows.length === 0 && !q) {
        setChatMessages([WELCOME]);
        return;
      }
      if (rows.length === 0 && q) {
        setChatMessages([]);
        return;
      }
      setChatMessages(
        rows.map((r) => ({
          role: r.role,
          text: r.content,
          id: r.id,
        })),
      );
    } catch {
      if (!q) setChatMessages([WELCOME]);
    } finally {
      if (showFullLoader && !q) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(undefined, true);
  }, [loadHistory]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounce(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const searchBootRef = useRef(true);
  useEffect(() => {
    if (searchBootRef.current) {
      searchBootRef.current = false;
      return;
    }
    void loadHistory(searchDebounce.trim() || undefined, false);
  }, [searchDebounce, loadHistory]);

  useEffect(() => {
    const onScroll = () => setScrollVisible(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatLoading) return;

    const userId = getChatUserId();
    setChatMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setChatInput("");
    setChatLoading(true);

    let assistantText = "";
    try {
      const response = await fetch("/api/huggingface/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
      };
      assistantText = body.ok
        ? body.message?.trim() || "No response returned from model."
        : body.error || "Unable to get AI response.";
      if (!body.ok) {
        toast.error(assistantText);
      }
      setChatMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } catch {
      assistantText = "Network error while contacting AI service.";
      toast.error(assistantText);
      setChatMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } finally {
      setChatLoading(false);
    }

    if (userId !== "ssr") {
      try {
        await appendChatMessages(userId, [
          { role: "user", content: prompt },
          { role: "assistant", content: assistantText },
        ]);
      } catch {
        // persistence optional; ignore
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[100vw] flex-col items-end gap-2 sm:bottom-6 sm:right-6 sm:gap-3">
        {scrollVisible && (
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50"
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
          aria-label={chatOpen ? "Close AI chat" : "Open AI chat"}
        >
          <Bot className="h-5 w-5" />
        </button>
      </div>

      {chatOpen && (
        <div
          className="fixed bottom-20 right-4 z-50 flex h-[min(480px,calc(100vh-6rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-6 sm:h-[min(480px,calc(100vh-8rem))] sm:w-[min(360px,calc(100vw-3rem))]"
          role="dialog"
          aria-label="AI assistant"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Seung AI Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-md p-1 text-slate-200 transition hover:bg-slate-800 hover:text-white"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search history..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
              />
            </div>
          </div>

          <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {historyLoading && (
              <p className="text-center text-xs text-slate-500">Loading history…</p>
            )}
            {!historyLoading &&
              chatMessages.map((msg, idx) => (
                <div
                  key={msg.id ?? `${msg.role}-${idx}`}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            {!historyLoading && chatLoading && (
              <div className="max-w-[85%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={sendChat} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask AI..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
