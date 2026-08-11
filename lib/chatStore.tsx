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
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastReadAt: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  unread: number;
}

interface ChatContextValue {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  /** Creates or finds a conversation with another profile and returns its id. */
  ensureConversation: (otherProfileId: string) => Promise<string | null>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  /** Marks my side of the conversation read and loads message history. */
  openConversation: (conversationId: string) => Promise<void>;
  refetch: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  const activeConversation = useRef<string | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

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

    async function loadConversations() {
      const { data, error: fetchError } = await supabase
        .from("conversations")
        .select("*, other:profiles!other_user_id(id, full_name, avatar_url)")
        .eq("participant_id", myProfileId)
        .order("last_message", { ascending: false });

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load conversations.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const sorted = [...rows].sort((a, b) =>
        (b.last_message || b.created_at || "").localeCompare(a.last_message || a.created_at || "")
      );

      setConversations(
        sorted.map((c: any) => ({
          id: c.id,
          otherId: c.other_user_id,
          name: c.other?.full_name ?? "Unknown",
          avatarUrl: c.other?.avatar_url ?? null,
          lastMessage: c.last_message,
          lastReadAt: c.last_read_at,
          messages: [],
          messagesLoading: false,
          unread: 0,
        }))
      );
      setError(null);
      setLoading(false);
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  // Realtime: incoming messages (from anyone in the school, per RLS we only
  // receive rows for conversations we participate in via the filter).
  useEffect(() => {
    if (!supabaseConfigured || !profile || conversations.length === 0) return;
    const supabase = createClient();
    const ids = conversations.map((c) => c.id);
    if (ids.length === 0) return;

    const channel = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=in.(${ids.join(",")})`,
        },
        (payload) => {
          const msg = payload.new as any;
          if (!msg) return;
          const conv = conversations.find((c) => c.id === msg.conversation_id);
          if (!conv) return;
          const mine = msg.from_id === profile.id;
          if (mine || seenMessageIds.current.has(msg.id)) return;
          seenMessageIds.current.add(msg.id);

          setConversations((prev) =>
            prev.map((c) =>
              c.id === msg.conversation_id
                ? {
                    ...c,
                    lastMessage: msg.text,
                    messages: [...c.messages, toMessage(msg, profile.id)],
                    unread: c.id === activeConversation.current ? 0 : c.unread + 1,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile, conversations.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
          return [
            {
              id: row.id,
              otherId: row.other_user_id,
              name: row.other?.full_name ?? "Unknown",
              avatarUrl: row.other?.avatar_url ?? null,
              lastMessage: row.last_message,
              lastReadAt: row.last_read_at,
              messages: [],
              messagesLoading: false,
              unread: 0,
            },
            ...prev,
          ];
        });
      } else {
        refetch();
      }
      return convId;
    },
    [profile, conversations, refetch]
  );

  const sendMessage = useCallback(
    async (conversationId: string, text: string) => {
      if (!profile) return;
      const supabase = createClient();
      const { data, error: sendError } = await (supabase as any).rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_text: text,
      });
      if (sendError) return;

      const messageId = data as string;
      // Optimistic-ish: append our own copy of the message immediately.
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const msg: ChatMessage = {
            id: messageId,
            fromId: profile.id,
            fromName: profile.full_name,
            text,
            createdAt: new Date().toISOString(),
            mine: true,
          };
          return { ...c, lastMessage: text, messages: [...c.messages, msg] };
        })
      );

      // Notify the other participant (best-effort).
      const other = conversations.find((c) => c.id === conversationId)?.otherId;
      if (other) {
        notifyUser(other, "message", profile.full_name, text, "/messages");
      }
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
            { id: conversationId, otherId: "", name: "Conversation", avatarUrl: null, lastMessage: null, lastReadAt: null, messages, messagesLoading: false, unread: 0 },
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

  const value = useMemo(
    () => ({ conversations, loading, error, ensureConversation, sendMessage, openConversation, refetch }),
    [conversations, loading, error, ensureConversation, sendMessage, openConversation, refetch]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within ChatProvider");
  return ctx;
}
