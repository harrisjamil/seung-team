"use client";

import { FleetPageLoader } from "@/app/components/FleetPageLoader";
import { FLEET_PAGE_SHELL } from "@/app/lib/fleet-shell-classes";
import { getSession, type AppSession } from "@/app/lib/auth";
import { dispatchCommunicationUnreadRefresh } from "@/app/lib/useCommunicationUnreadCount";
import { getBrowserSupabase } from "@/app/lib/supabaseBrowser";
import { CaptainHeader } from "@/app/captain/components/CaptainHeader";
import { CommandHeader } from "@/app/command/components/CommandHeader";
import { CommandSubpagePanel } from "@/app/command/components/CommandSubpagePanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComments,
  faTowerBroadcast,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

type UserRow = {
  user_id: string;
  username: string;
  role: string;
  ship_id: string | null;
  display_name: string;
};

type DmRow = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  body: string;
  created_at: string;
};

export default function FleetCommunication({ role }: { role: "command" | "captain" }) {
  const router = useRouter();
  /** Never read localStorage in useState initializer — SSR and first client paint must match. */
  const [session, setSession] = useState<AppSession | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loadUsersErr, setLoadUsersErr] = useState<string | null>(null);
  const [loadMsgErr, setLoadMsgErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const peer = useMemo(() => users.find((u) => u.user_id === peerId) ?? null, [users, peerId]);

  const markThreadRead = useCallback(async (me: AppSession, peer: string) => {
    try {
      const res = await fetch("/api/communication/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUserId: me.userId,
          peerUserId: peer,
        }),
      });
      if (res.ok) {
        dispatchCommunicationUnreadRefresh();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== role) {
      router.replace("/");
    }
    window.queueMicrotask(() => {
      setSession(s ?? null);
      setClientReady(true);
    });
  }, [router, role]);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadUsers = useCallback(async (me: AppSession) => {
    setLoadUsersErr(null);
    const res = await fetch(
      `/api/communication/users?excludeUserId=${encodeURIComponent(me.userId)}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as { ok?: boolean; users?: UserRow[]; error?: string };
    if (!res.ok || !json.ok) {
      const msg = json.error ?? "Could not load users.";
      setLoadUsersErr(msg);
      toast.error(msg);
      return;
    }
    setUsers(json.users ?? []);
  }, []);

  const loadMessages = useCallback(
    async (me: AppSession, other: string) => {
      setMessages([]);
      setLoadMsgErr(null);
      const q = new URLSearchParams({
        userId: me.userId,
        peerUserId: other,
      });
      const res = await fetch(`/api/communication/messages?${q}`, { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; messages?: DmRow[]; error?: string };
      if (!res.ok || !json.ok) {
        const msg = json.error ?? "Could not load messages.";
        setLoadMsgErr(msg);
        toast.error(msg);
        setMessages([]);
        return;
      }
      setMessages(json.messages ?? []);
      await markThreadRead(me, other);
    },
    [markThreadRead],
  );

  useEffect(() => {
    if (!session) return;
    const t = window.setTimeout(() => {
      void loadUsers(session);
    }, 0);
    return () => clearTimeout(t);
  }, [session, loadUsers]);

  useEffect(() => {
    if (!session || !peerId) return;
    const t = window.setTimeout(() => {
      void loadMessages(session, peerId);
    }, 0);
    return () => clearTimeout(t);
  }, [session, peerId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerId, scrollToBottom]);

  useEffect(() => {
    if (!session) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`direct-messages:${session.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DmRow | null;
          if (!row) return;
          const involvesMe =
            row.from_user_id === session.userId || row.to_user_id === session.userId;
          if (!involvesMe) return;

          if (row.to_user_id === session.userId && peerId && row.from_user_id !== peerId) {
            dispatchCommunicationUnreadRefresh();
            return;
          }

          const matchPeer =
            peerId &&
            ((row.from_user_id === session.userId && row.to_user_id === peerId) ||
              (row.from_user_id === peerId && row.to_user_id === session.userId));
          if (!matchPeer) {
            if (row.to_user_id === session.userId) {
              dispatchCommunicationUnreadRefresh();
            }
            return;
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          if (row.to_user_id === session.userId && row.from_user_id === peerId) {
            void markThreadRead(session, peerId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, peerId, markThreadRead]);

  const send = async () => {
    if (!session || !peerId || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch("/api/communication/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: session.userId,
          toUserId: peerId,
          body: text,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: DmRow; error?: string };
      if (!res.ok || !json.ok || !json.message) {
        const msg = json.error ?? "Send failed.";
        setLoadMsgErr(msg);
        toast.error(msg);
        return;
      }
      setDraft("");
      setMessages((prev) => {
        if (prev.some((m) => m.id === json.message!.id)) return prev;
        return [...prev, json.message!];
      });
    } finally {
      setSending(false);
    }
  };

  const Header =
    role === "command" ? (
      <CommandHeader
        connected={false}
        openAlertsCount={0}
        distressedCount={0}
        adverseCount={0}
        router={router}
      />
    ) : (
      <CaptainHeader
        connected={false}
        openAlertsCount={0}
        distressedCount={0}
        adverseCount={0}
        router={router}
      />
    );

  if (!clientReady || !session || session.role !== role) {
    return (
      <FleetPageLoader
        message={!clientReady || !session ? "Loading…" : "Redirecting…"}
      />
    );
  }

  return (
    <div className={FLEET_PAGE_SHELL}>
      {Header}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 sm:gap-6 sm:px-5 sm:py-5 lg:px-6">
        <CommandSubpagePanel
          icon={faComments}
          title="Secure fleet messaging"
          subtitle="Real-time direct messages with command, captains, and operators"
          badges={[
            { label: `${users.length} contacts`, icon: faUsers },
            { label: "Realtime", icon: faTowerBroadcast },
          ]}
        >
          <div className="flex min-h-[calc(100vh-14rem)] flex-col overflow-hidden md:flex-row">
            <aside className="flex w-full flex-shrink-0 flex-col border-b border-slate-200 md:w-80 md:border-r md:border-b-0">
              <div className="border-b border-slate-100 p-3">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                      <FontAwesomeIcon icon={faUsers} className="text-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                        Directory
                      </h2>
                      <p className="text-xs font-medium text-slate-500">
                        {users.length} contact{users.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Live
                    </span>
                  </div>
                </div>
              </div>
              <div className="hide-scrollbar max-h-52 flex-1 overflow-y-auto px-2 pb-3 md:max-h-none">
                {loadUsersErr ? (
                  <p className="px-3 py-3 text-sm text-red-600">{loadUsersErr}</p>
                ) : users.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-500">No other users found.</p>
                ) : (
                  <ul className="space-y-1.5 pr-1">
                    {users.map((u) => (
                      <li key={u.user_id}>
                        <button
                          type="button"
                          onClick={() => setPeerId(u.user_id)}
                          className={`flex w-full flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-3 text-left text-sm transition-all ${
                            peerId === u.user_id
                              ? "border-sky-300 bg-gradient-to-r from-sky-100 to-blue-50 shadow-md shadow-sky-100/60"
                              : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                          }`}
                        >
                          <span className="font-semibold text-slate-900">{u.display_name}</span>
                          <span className="text-xs font-medium capitalize text-slate-500">
                            {u.role}
                            {u.ship_id ? ` · ${u.ship_id}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            <section className="flex min-h-[min(360px,50vh)] flex-1 flex-col bg-slate-50/50">
              {!peer ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <FontAwesomeIcon icon={faComments} className="text-2xl text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Select a contact</p>
                  <p className="max-w-xs text-xs text-slate-500">
                    Choose someone from the directory to open a conversation.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{peer.display_name}</p>
                    <p className="text-xs text-slate-500">{peer.username}</p>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col">
                    {loadMsgErr ? (
                      <p className="px-4 py-2 text-sm text-red-600">{loadMsgErr}</p>
                    ) : null}
                    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                      {(peerId ? messages : []).map((m) => {
                        const mine = m.from_user_id === session.userId;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                mine
                                  ? "bg-slate-900 text-white"
                                  : "border border-slate-200 bg-white text-slate-900"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <p
                                className={`mt-1 text-[10px] ${
                                  mine ? "text-slate-300" : "text-slate-400"
                                }`}
                              >
                                {new Date(m.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={listEndRef} />
                    </div>
                    <div className="border-t border-slate-200 bg-white p-3">
                      <div className="flex gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                          rows={2}
                          placeholder="Message… (Enter to send)"
                          className="min-h-[44px] flex-1 resize-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => void send()}
                          disabled={sending || !draft.trim()}
                          className="self-end rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </CommandSubpagePanel>
      </div>
    </div>
  );
}
