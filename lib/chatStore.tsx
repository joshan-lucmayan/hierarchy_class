"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { notifyUser } from "@/lib/notify";

export type ChatRole = "student" | "teacher" | "admin";

export interface ChatMessage {
  id: string;
  fromId: string | null;
  fromName: string;
  text: string;
  createdAt: string;
  mine: boolean;
}

export interface Conversation {
  id: string;
  otherId: string;
  otherRole: ChatRole;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  archived: boolean;
  messages: ChatMessage[];
  messagesLoading: boolean;
  unread: number;
}

interface ChatContextValue {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  loading: boolean;
  error: string | null;
  blocks: Set<string>;
  /** Creates or finds a conversation with another profile and returns its id. */
  ensureConversation: (otherProfileId: string) => Promise<string | null>;
  sendMessage: (conversationId: string, text: string) => Promise<boolean>;
  /** Marks my side read and loads message history. */
  openConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  unarchiveConversation: (conversationId: string) => Promise<void>;
  hideConversation: (conversationId: string) => Promise<void>;
  markUnread: (conversationId: string) => Promise<void>;
  blockUser: (otherProfileId: string) => Promise<void>;
  unblockUser: (otherProfileId: string) => Promise<void>;
  refetch: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function toMessage(m: any, myProfileId: string): ChatMessage {
  return {
    id: m.id,
    fromId: m.from_id,
    fromName: m.from_name,
    text: m.text,
    createdAt: m.created_at,
    mine: m.from_id === myProfileId,
  };
}

function toConversation(row: any, unreadByConv: Record<string, number>): Conversation {
  return {
    id: row.id,
    otherId: row.other_user_id,
    otherRole: (row.role ?? "student") as ChatRole,
    name: row.other?.full_name ?? "Unknown",
    avatarUrl: row.other?.avatar_url ?? null,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    lastReadAt: row.last_read_at,
    archived: !!row.archived_at,
    messages: [],
    messagesLoading: false,
    unread: unreadByConv[row.id] ?? 0,
  };
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  const [blocks, setBlocks] = useState<Set<string>>(new Set());
  const activeConversation = useRef<string | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  // Load conversations + unread counts + my blocks in one effect.
  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const myProfileId = profile.id;
    const supabase = createClient();

    async function loadAll() {
      const [convRes, unreadRes, blockRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("*, other:profiles!other_user_id(id, full_name, avatar_url)")
          .eq("participant_id", myProfileId)
          .is("deleted_at", null)
          .order("last_message", { ascending: false }),
        (supabase as any).rpc("get_unread_counts"),
        supabase.from("chat_blocks").select("blocked_id"),
      ]);

      if (cancelled) return;

      if (convRes.error) {
        setError("Couldn't load conversations.");
        setLoading(false);
        return;
      }

      const unreadByConv: Record<string, number> = {};
      ((unreadRes.data ?? []) as any[]).forEach((u: any) => {
        unreadByConv[u.conversation_id] = Number(u.unread) || 0;
      });

      const rows = ((convRes.data ?? []) as any[]).sort((a, b) =>
        (b.last_message_at || b.last_message || b.created_at || "").localeCompare(
          a.last_message_at || a.last_message || a.created_at || ""
        )
      );

      setConversations(rows.map((c) => toConversation(c, unreadByConv)));
      setBlocks(
        new Set(((blockRes.data ?? []) as any[]).map((b: any) => b.blocked_id))
      );
      setError(null);
      setLoading(false);
    }

    loadAll();

    // Blocks can change while the messenger is open (block/unblock).
    const channel = supabase
      .channel("chat-blocks-mine")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_blocks" },
        () => {
          if (cancelled) return;
          supabase
            .from("chat_blocks")
            .select("blocked_id")
            .then(({ data }) => {
              if (!cancelled && data) {
                setBlocks(new Set((data as any[]).map((b: any) => b.blocked_id)));
              }
            });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured, profile, refetchTick]);

  // Realtime: incoming messages. We subscribe ONCE with no conversation
  // filter - RLS only delivers events for conversations this user actually
  // participates in, so there is nothing to re-create when the list grows.
  useEffect(() => {
    if (!supabaseConfigured || !profile) return;
    const supabase = createClient();
    const myProfileId = profile.id;

    const channel = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!msg) return;
          // Our own sends are appended optimistically by sendMessage, so a
          // realtime echo of our own message must be ignored to avoid dupes.
          if (msg.from_id === myProfileId) return;
          if (seenMessageIds.current.has(msg.id)) return;
          seenMessageIds.current.add(msg.id);

          // A message for a conversation we don't have yet (e.g. it was
          // hidden, or created on another device) - refetch the list.
          if (!conversationsRef.current.some((c) => c.id === msg.conversation_id)) {
            setRefetchTick((t) => t + 1);
            return;
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === msg.conversation_id);
            if (idx === -1) return prev;
            const conv = prev[idx];
            const already = conv.messages.some((m) => m.id === msg.id);
            if (already) return prev;
            const isActive = activeConversation.current === conv.id;
            const updated = {
              ...conv,
              lastMessage: msg.text,
              lastMessageAt: msg.created_at,
            };
            if (isActive) updated.messages = [...conv.messages, toMessage(msg, myProfileId)];
            else updated.unread = conv.unread + 1;
            const next = [...prev];
            next[idx] = updated;
            // Keep newest-first ordering by last activity.
            next.sort((a, b) =>
              (b.lastMessageAt || b.lastReadAt || "").localeCompare(a.lastMessageAt || a.lastReadAt || "")
            );
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured, profile]);

  const ensureConversation = useCallback(
    async (otherProfileId: string): Promise<string | null> => {
      if (!profile) return null;
      const existing = conversations.find((c) => c.otherId === otherProfileId);
      if (existing) return existing.id;

      const supabase = createClient();
      const { data, error: rpcError } = await (supabase as any).rpc("ensure_conversation", {
        p_other_user_id: otherProfileId,
      });
      if (rpcError) return null;
      const convId = data as string;

      // Fetch the fresh row (with the other profile) so it appears immediately.
      const { data: fresh } = await supabase
        .from("conversations")
        .select("*, other:profiles!other_user_id(id, full_name, avatar_url)")
        .eq("id", convId)
        .single();
      if (fresh) {
        setConversations((prev) => {
          if (prev.some((c) => c.id === convId)) return prev;
          const row = fresh as any;
          return [toConversation(row, {}), ...prev];
        });
      } else {
        refetch();
      }
      return convId;
    },
    [profile, conversations, refetch]
  );

  const sendMessage = useCallback(
    async (conversationId: string, text: string): Promise<boolean> => {
      if (!profile) return false;
      const supabase = createClient();
      const { data, error: sendError } = await (supabase as any).rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_text: text,
      });
      if (sendError) return false;

      const messageId = data as string;
      // The RPC committed the row - append exactly one copy (the realtime
      // echo of our own message is filtered out above by from_id).
      const msg: ChatMessage = {
        id: messageId,
        fromId: profile.id,
        fromName: profile.full_name,
        text,
        createdAt: new Date().toISOString(),
        mine: true,
      };
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) return prev;
        const conv = prev[idx];
        const already = conv.messages.some((m) => m.id === messageId);
        const updated = { ...conv, lastMessage: text, lastMessageAt: new Date().toISOString() };
        updated.messages = already ? conv.messages : [...conv.messages, msg];
        const next = [...prev];
        next[idx] = updated;
        next.sort((a, b) =>
          (b.lastMessageAt || b.lastReadAt || "").localeCompare(a.lastMessageAt || a.lastReadAt || "")
        );
        return next;
      });

      // Notify the other participant (best-effort, one per send).
      const other = conversations.find((c) => c.id === conversationId)?.otherId;
      if (other) {
        notifyUser(other, "message", profile.full_name, text, "/messages");
      }
      return true;
    },
    [profile, conversations]
  );

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!profile) return;
      activeConversation.current = conversationId;
      const myProfileId = profile.id;
      const supabase = createClient();

      // Mark my side read.
      await (supabase.from("conversations") as any)
        .update({ last_read_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("participant_id", myProfileId);

      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      const messages = ((data ?? []) as any[]).map((m: any) => toMessage(m, myProfileId));
      messages.forEach((m) => seenMessageIds.current.add(m.id));

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversationId);
        if (!exists) {
          // Conversation was created outside the store (e.g. via ?with=).
          return [
            {
              id: conversationId,
              otherId: "",
              otherRole: "student" as ChatRole,
              name: "Conversation",
              avatarUrl: null,
              lastMessage: null,
              lastMessageAt: null,
              lastReadAt: new Date().toISOString(),
              archived: false,
              messages,
              messagesLoading: false,
              unread: 0,
            },
            ...prev,
          ];
        }
        return prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages, messagesLoading: false, unread: 0, lastReadAt: new Date().toISOString() }
            : c
        );
      });
    },
    [profile]
  );

  /** Toggle helpers: these update MY row only - the other user's copy of the
   *  conversation and all messages are untouched. */
  const archiveConversation = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    await (supabase.from("conversations") as any)
      .update({ archived_at: new Date().toISOString(), deleted_at: null })
      .eq("id", conversationId)
      .eq("participant_id", profile?.id);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, archived: true } : c)));
  }, [profile]);

  const unarchiveConversation = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    await (supabase.from("conversations") as any)
      .update({ archived_at: null })
      .eq("id", conversationId)
      .eq("participant_id", profile?.id);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, archived: false } : c)));
  }, [profile]);

  const hideConversation = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    await (supabase.from("conversations") as any)
      .update({ deleted_at: new Date().toISOString(), archived_at: null })
      .eq("id", conversationId)
      .eq("participant_id", profile?.id);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
  }, [profile]);

  const markUnread = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    await (supabase.from("conversations") as any)
      .update({ last_read_at: null })
      .eq("id", conversationId)
      .eq("participant_id", profile?.id);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lastReadAt: null, unread: c.messages.filter((m) => !m.mine).length }
          : c
      )
    );
  }, [profile]);

  const blockUser = useCallback(async (otherProfileId: string) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("chat_blocks").insert({ blocker_id: profile.id, blocked_id: otherProfileId } as any);
    setBlocks((prev) => new Set(prev).add(otherProfileId));
  }, [profile]);

  const unblockUser = useCallback(async (otherProfileId: string) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("chat_blocks").delete().eq("blocker_id", profile.id).eq("blocked_id", otherProfileId);
    setBlocks((prev) => {
      const next = new Set(prev);
      next.delete(otherProfileId);
      return next;
    });
  }, [profile]);

  const archived = useMemo(() => conversations.filter((c) => c.archived), [conversations]);
  const active = useMemo(() => conversations.filter((c) => !c.archived), [conversations]);

  const value = useMemo(
    () => ({
      conversations: active,
      archivedConversations: archived,
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
      refetch,
    }),
    [
      active,
      archived,
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
      refetch,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within ChatProvider");
  return ctx;
}
