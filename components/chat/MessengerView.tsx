"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChatStore, ChatRole } from "@/lib/chatStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useMyProfile } from "@/lib/useMyProfile";
import type { ProfileRow } from "@/types/supabase";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MessengerView({ role: _role }: { role: ChatRole }) {
  const searchParams = useSearchParams();
  const withId = searchParams.get("with");
  const { profile: me } = useMyProfile();
  const {
    conversations,
    archivedConversations,
    loading,
    error,
    blocks,
    ensureConversation,
    sendMessage,
    openConversation,
    archiveConversation,
    unarchiveConversation,
    hideConversation,
    markUnread,
    blockUser,
    unblockUser,
  } = useChatStore();
  const { profiles: people, loading: peopleLoading } = useSchoolProfiles();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<"hide" | "block" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const openingWith = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  const list = showArchived ? archivedConversations : conversations;

  // Open the most recent conversation once loaded (when not deep-linked).
  useEffect(() => {
    if (!activeId && list.length > 0 && !withId) {
      const first = list[0];
      setActiveId(first.id);
      openConversation(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, withId]);

  // ?with=<profileId> - create/find the conversation and open it. The ref
  // guards against StrictMode double-invoking this effect (which previously
  // raced ensure_conversation into duplicate rows).
  useEffect(() => {
    if (!withId) return;
    if (openingWith.current === withId) return;
    openingWith.current = withId;
    setActionError(null);
    ensureConversation(withId).then((id) => {
      openingWith.current = null;
      if (id) {
        setActiveId(id);
        setShowArchived(false);
        openConversation(id);
      } else {
        setActionError("Couldn't start a conversation with that person. They may have blocked you or the chat is unavailable.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withId]);

  const active = list.find((c) => c.id === activeId) ?? conversations.find((c) => c.id === activeId) ?? null;
  const isBlocked = active ? blocks.has(active.otherId) : false;

  // Scroll to the newest message, but only when the thread grows - never on
  // unrelated re-renders, so the view stays stable while typing.
  useEffect(() => {
    const count = active?.messages.length ?? 0;
    if (count !== messageCountRef.current) {
      messageCountRef.current = count;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.messages.length]);

  const filteredConversations = useMemo(
    () =>
      list.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.lastMessage ?? "").toLowerCase().includes(query.toLowerCase())
      ),
    [list, query]
  );

  const personResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return (people ?? [])
      .filter((p) => p.id !== me?.id)
      .filter((p) => p.full_name.toLowerCase().includes(normalized))
      .filter((p) => !blocks.has(p.id))
      .slice(0, 8);
  }, [people, query, me, blocks]);

  const showingPeople = query.trim().length > 0 && personResults.length > 0;

  async function handleSelect(id: string) {
    setActionError(null);
    setActiveId(id);
    setShowArchived(false);
    await openConversation(id);
  }

  async function handleStartConversation(person: ProfileRow) {
    setActionError(null);
    setQuery("");
    const id = await ensureConversation(person.id);
    if (id) {
      setActiveId(id);
      await openConversation(id);
    } else {
      setActionError(`Couldn't message ${person.full_name}. They may have blocked you.`);
    }
  }

  async function handleSend() {
    if (!active || !draft.trim() || sending || isBlocked) return;
    setSending(true);
    const ok = await sendMessage(active.id, draft);
    setSending(false);
    if (ok) setDraft("");
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px] overflow-hidden rounded-[10px] border border-base">
      {/* Left column: conversation list / search */}
      <div className="flex w-full max-w-[300px] shrink-0 flex-col border-r border-base">
        <div className="flex items-center justify-between border-b border-base p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-navy">Messages</p>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              showArchived ? "border-gold-token bg-[var(--surface-strong)] text-navy" : "border-base bg-surface text-muted hover:border-gold-soft"
            }`}
          >
            {showArchived ? "Inbox" : `Archived${archivedConversations.length > 0 ? ` (${archivedConversations.length})` : ""}`}
          </button>
        </div>
        <div className="border-b border-base p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showArchived ? "Filter archived..." : "Search people or chats..."}
            className="w-full rounded-full border border-base bg-surface px-4 py-2 text-sm text-navy placeholder:text-muted outline-none focus:border-gold"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted">Loading conversations...</p>
          ) : error ? (
            <p className="p-4 text-sm text-warn">{error}</p>
          ) : showingPeople ? (
            <div className="py-2">
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">People</p>
              {personResults.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleStartConversation(person)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <UserAvatar name={person.full_name} src={person.avatar_url} size="md" profileId={person.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{person.full_name}</p>
                    <p className="truncate text-[11px] text-muted">
                      {ROLE_LABEL[person.role] ?? person.role}
                      {person.role === "student"
                        ? ` · ${[person.educational_level, person.level_label].filter(Boolean).join(" · ")}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold-token">Message</span>
                </button>
              ))}
            </div>
          ) : query.trim() && filteredConversations.length === 0 ? (
            <p className="p-4 text-sm text-muted">No people or chats match “{query}”.</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              {showArchived
                ? "No archived conversations."
                : "No conversations yet - search for a student, teacher, or admin above to start chatting."}
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
                <UserAvatar name={c.name} src={c.avatarUrl} size="lg" profileId={c.otherId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-navy">{c.name}</p>
                    <span className="shrink-0 text-[10px] text-muted">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted">{c.lastMessage || "No messages yet"}</p>
                    {c.unread > 0 && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-token text-[10px] font-bold text-on-accent">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right column: conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-base p-4">
              <UserAvatar name={active.name} src={active.avatarUrl} size="lg" profileId={active.otherId} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{active.name}</p>
                {active.otherId && (
                  <p className="text-[11px] uppercase tracking-wide text-muted">
                    {ROLE_LABEL[active.otherRole] ?? active.otherRole}
                    {isBlocked ? " · Blocked" : ""}
                  </p>
                )}
              </div>
              {active.otherId && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Conversation options"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-base text-muted transition hover:border-gold-soft hover:text-navy"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <>
                      <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[10px] border border-base bg-surface py-1">
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); markUnread(active.id); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-navy transition hover:bg-[var(--surface-strong)]"
                        >
                          Mark as unread
                        </button>
                        {active.archived || showArchived ? (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); unarchiveConversation(active.id); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-navy transition hover:bg-[var(--surface-strong)]"
                          >
                            Move to inbox
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); archiveConversation(active.id); setActiveId(null); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-navy transition hover:bg-[var(--surface-strong)]"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirming("hide");
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-warn transition hover-bg-warn-soft"
                        >
                          Delete conversation
                        </button>
                        <div className="my-1 border-t border-base" />
                        {isBlocked ? (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); unblockUser(active.otherId); }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-navy transition hover:bg-[var(--surface-strong)]"
                          >
                            Unblock {active.name.split(" ")[0]}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              setConfirming("block");
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-warn transition hover-bg-warn-soft"
                          >
                            Block {active.name.split(" ")[0]}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
              {actionError && <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">{actionError}</p>}
              {active.messagesLoading ? (
                <p className="text-center text-sm text-muted">Loading messages...</p>
              ) : active.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold-token">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-navy">No messages yet</p>
                  <p className="text-xs text-muted">Say hi to {active.name.split(" ")[0]} - the conversation starts here.</p>
                </div>
              ) : (
                (() => {
                  // Insert a day separator whenever the day changes.
                  let lastDay: string | null = null;
                  const rows: React.ReactNode[] = [];
                  active.messages.forEach((m) => {
                    const day = new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    if (day !== lastDay) {
                      lastDay = day;
                      const isToday =
                        new Date(m.createdAt).toDateString() === new Date().toDateString();
                      rows.push(
                        <div key={`day-${m.id}`} className="flex items-center justify-center gap-3 py-1">
                          <span className="h-px w-8 bg-[var(--border)]" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                            {isToday ? "Today" : day}
                          </span>
                          <span className="h-px w-8 bg-[var(--border)]" />
                        </div>
                      );
                    }
                    rows.push(
                      <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                        <span
                          className={`max-w-[72%] whitespace-pre-wrap break-words rounded-[14px] px-4 pb-1.5 pt-2.5 text-sm leading-relaxed shadow-sm ${
                            m.mine
                              ? "rounded-br-[4px] bg-gold-token text-on-accent"
                              : "rounded-bl-[4px] bg-[var(--surface-strong)] text-navy"
                          }`}
                        >
                          {m.text}
                          <span
                            className={`ml-3 inline-block translate-y-[2px] text-[9.5px] font-medium tabular-nums ${
                              m.mine ? "text-on-accent/60" : "text-faint"
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </span>
                      </div>
                    );
                  });
                  return rows;
                })()
              )}
            </div>

            <div className="border-t border-base p-4">
              {isBlocked ? (
                <p className="rounded-full border border-warn-soft bg-warn-soft px-4 py-2.5 text-center text-xs font-semibold text-warn">
                  You&apos;ve blocked this user - unblock them to send messages.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 rounded-full border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    loading={sending}
                    icon={
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13" />
                        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    }
                  >
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            {peopleLoading ? (
              <p className="text-sm text-muted">Loading directory...</p>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-soft text-gold-token">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                </span>
                <p className="text-sm font-semibold text-navy">Select a conversation</p>
                <p className="max-w-xs text-xs text-muted">
                  Search for a student, teacher, or admin in the sidebar, or pick an existing chat to keep talking.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {confirming && active && (
        <Modal
          onClose={() => setConfirming(null)}
          eyebrow={confirming === "hide" ? "Delete conversation" : "Block user"}
          description={confirming === "hide" ? `Hide \"${active.name}\"?` : `Block ${active.name}?`}
        >
          <p className="mt-2 text-sm leading-6 text-muted">
            {confirming === "hide"
              ? "This removes the conversation from your inbox. The other person keeps their copy."
              : "You won't receive messages from them and they can't message you. You can unblock anytime."}
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (confirming === "hide") {
                  hideConversation(active.id);
                  setActiveId(null);
                } else {
                  blockUser(active.otherId);
                }
                setConfirming(null);
              }}
            >
              {confirming === "hide" ? "Delete conversation" : "Block"}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
