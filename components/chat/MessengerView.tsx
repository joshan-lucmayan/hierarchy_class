"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChatStore, ChatRole } from "@/lib/chatStore";

export function MessengerView({ role }: { role: ChatRole }) {
  const searchParams = useSearchParams();
  const withId = searchParams.get("with");
  const { conversations, loading, error, ensureConversation, sendMessage, openConversation } = useChatStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open the most recent conversation once loaded.
  useEffect(() => {
    if (!activeId && conversations.length > 0 && !withId) {
      const first = conversations[0];
      setActiveId(first.id);
      openConversation(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length, withId]);

  // ?with=<profileId> - create/find the conversation and open it.
  useEffect(() => {
    if (!withId) return;
    setOpeningId(withId);
    ensureConversation(withId).then((id) => {
      setOpeningId(null);
      if (id) {
        setActiveId(id);
        openConversation(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withId]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [conversations, query]
  );

  async function handleSelect(id: string) {
    setActiveId(id);
    openConversation(id);
  }

  async function handleSend() {
    if (!active || !draft.trim()) return;
    await sendMessage(active.id, draft);
    setDraft("");
  }

  const defaultAvatar = "/avatars/default-avatar.webp";

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] overflow-hidden rounded-2xl border border-base">
      <div className="flex w-full max-w-[280px] shrink-0 flex-col border-r border-base">
        <div className="border-b border-base p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-navy">Messages</p>
        </div>
        <div className="border-b border-base p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-full border border-base bg-surface px-4 py-2 text-sm text-navy outline-none focus:border-gold"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted">Loading conversations...</p>
          ) : error ? (
            <p className="p-4 text-sm text-red-500">{error}</p>
          ) : filteredConversations.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              No conversations yet - find someone in Search and press Message.
            </p>
          ) : (
            filteredConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  activeId === c.id ? "bg-[var(--surface-strong)]" : "hover:bg-[var(--surface-strong)]"
                }`}
              >
                <img
                  src={c.avatarUrl || defaultAvatar}
                  alt={c.name}
                  className="h-11 w-11 shrink-0 rounded-full border border-base object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{c.name}</p>
                  <p className="truncate text-xs text-muted">{c.lastMessage || "No messages yet"}</p>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                    {c.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {openingId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">Opening conversation...</div>
        ) : active ? (
          <>
            <div className="flex items-center gap-3 border-b border-base p-4">
              <img
                src={active.avatarUrl || defaultAvatar}
                alt={active.name}
                className="h-10 w-10 rounded-full border border-base object-cover"
              />
              <p className="text-sm font-semibold text-navy">{active.name}</p>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
              {active.messages.length === 0 ? (
                <p className="text-center text-sm text-muted">No messages yet - say hi!</p>
              ) : (
                active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <span
                      className={`max-w-[65%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.mine ? "bg-gold text-navy" : "bg-[var(--surface-strong)] text-navy"
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 border-t border-base p-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={handleSend}
                className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
