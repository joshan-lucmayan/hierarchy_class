"use client";

import { useMemo, useState } from "react";
import { CONVERSATIONS, Conversation } from "@/data/chats";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [conversations, query]
  );

  function sendMessage() {
    if (!active || !draft.trim()) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, lastMessage: draft, messages: [...c.messages, { id: `m${Date.now()}`, from: "me", text: draft }] }
          : c
      )
    );
    setDraft("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-base bg-surface text-navy transition hover:border-gold"
        aria-label="Open chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsOpen(false)}>
          <div
            className="animate-modal-in flex h-[560px] w-full max-w-3xl overflow-hidden rounded-3xl border-2 border-gold bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full max-w-[240px] shrink-0 flex-col border-r border-base">
              <div className="flex items-center justify-between border-b border-base p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-navy">Messages</p>
                <button type="button" onClick={() => setIsOpen(false)} className="text-muted">✕</button>
              </div>
              <div className="border-b border-base p-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full rounded-full border border-base bg-surface px-3 py-1.5 text-xs text-navy outline-none focus:border-gold"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <p className="p-4 text-xs text-muted">No contacts found.</p>
                ) : (
                  filteredConversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        activeId === c.id ? "bg-[var(--surface-strong)]" : "hover:bg-[var(--surface-strong)]"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-gold">
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{c.name}</p>
                        <p className="truncate text-xs text-muted">{c.lastMessage}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              {active ? (
                <>
                  <div className="border-b border-base p-4">
                    <p className="text-sm font-semibold text-navy">{active.name}</p>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {active.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                        <span
                          className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                            m.from === "me" ? "bg-gold text-navy" : "bg-[var(--surface-strong)] text-navy"
                          }`}
                        >
                          {m.text}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t border-base p-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full border border-base bg-surface px-4 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
                    >
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
