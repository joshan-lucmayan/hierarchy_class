"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CONVERSATIONS as DEFAULT_CONVERSATIONS, Conversation } from "@/data/chats";

const STORAGE_CONVERSATIONS = "hc-conversations";

function makeMessageId() {
  return `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ChatContextValue {
  conversations: Conversation[];
  ensureConversation: (id: string, name: string, initials: string) => void;
  sendUserMessage: (conversationId: string, text: string) => void;
  sendSystemMessage: (id: string, name: string, initials: string, text: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(DEFAULT_CONVERSATIONS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_CONVERSATIONS);
      if (saved) setConversations(JSON.parse(saved));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  function ensureConversation(id: string, name: string, initials: string) {
    setConversations((prev) =>
      prev.some((c) => c.id === id) ? prev : [{ id, name, initials, lastMessage: "", messages: [] }, ...prev]
    );
  }

  function sendUserMessage(conversationId: string, text: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: text, messages: [...c.messages, { id: makeMessageId(), from: "me", text }] }
          : c
      )
    );
  }

  function sendSystemMessage(id: string, name: string, initials: string, text: string) {
    setConversations((prev) => {
      const msg = { id: makeMessageId(), from: "them" as const, text };
      if (prev.some((c) => c.id === id)) {
        return prev.map((c) => (c.id === id ? { ...c, lastMessage: text, messages: [...c.messages, msg] } : c));
      }
      return [{ id, name, initials, lastMessage: text, messages: [msg] }, ...prev];
    });
  }

  const value = useMemo(
    () => ({ conversations, ensureConversation, sendUserMessage, sendSystemMessage }),
    [conversations]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within a ChatProvider");
  return ctx;
}
