"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STUDENT_DIRECTORY, TEACHER_DIRECTORY } from "@/data/mockStudents";
import { useChatStore, ChatRole } from "@/lib/chatStore";

export function MessengerView({ role }: { role: ChatRole }) {
  const searchParams = useSearchParams();
  const withId = searchParams.get("with");
  const { getConversations, ensureConversation, sendUserMessage } = useChatStore();
  const conversations = getConversations(role);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  useEffect(() => {
    if (!withId) return;
    const person = STUDENT_DIRECTORY.find((s) => s.id === withId) ?? TEACHER_DIRECTORY.find((t) => t.id === withId);
    if (person) {
      ensureConversation(role, withId, person.name.split(" ")[0], person.initials);
    }
    setActiveId(withId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [conversations, query]
  );

  function sendMessage() {
    if (!active || !draft.trim()) return;
    sendUserMessage(role, active.id, draft);
    setDraft("");
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] overflow-hidden rounded-2xl">
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
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-sm text-muted">No contacts found.</p>
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
                <img src="/avatars/default-avatar.webp" alt={c.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{c.name}</p>
                  <p className="truncate text-xs text-muted">{c.lastMessage || "No messages yet"}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-base p-4">
              <img src="/avatars/default-avatar.webp" alt={active.name} className="h-10 w-10 rounded-full object-cover" />
              <p className="text-sm font-semibold text-navy">{active.name}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {active.messages.length === 0 ? (
                <p className="text-center text-sm text-muted">No messages yet - say hi!</p>
              ) : (
                active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <span
                      className={`max-w-[65%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.from === "me" ? "bg-gold text-navy" : "bg-[var(--surface-strong)] text-navy"
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
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={sendMessage}
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
