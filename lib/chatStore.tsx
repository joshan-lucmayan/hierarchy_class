"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  STUDENT_CONVERSATIONS,
  TEACHER_CONVERSATIONS,
  ADMIN_CONVERSATIONS,
  Conversation,
} from "@/data/chats";

export type ChatRole = "student" | "teacher" | "admin";

const STORAGE_KEY: Record<ChatRole, string> = {
  student: "hc-conversations-student",
  teacher: "hc-conversations-teacher",
  admin: "hc-conversations-admin",
};

const DEFAULTS: Record<ChatRole, Conversation[]> = {
  student: STUDENT_CONVERSATIONS,
  teacher: TEACHER_CONVERSATIONS,
  admin: ADMIN_CONVERSATIONS,
};

function makeMessageId() {
  return `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ChatContextValue {
  getConversations: (role: ChatRole) => Conversation[];
  ensureConversation: (role: ChatRole, id: string, name: string, initials: string) => void;
  sendUserMessage: (role: ChatRole, conversationId: string, text: string) => void;
  sendSystemMessage: (role: ChatRole, id: string, name: string, initials: string, text: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [byRole, setByRole] = useState<Record<ChatRole, Conversation[]>>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const next = { ...DEFAULTS };
      (Object.keys(STORAGE_KEY) as ChatRole[]).forEach((role) => {
        const saved = window.localStorage.getItem(STORAGE_KEY[role]);
        if (saved) next[role] = JSON.parse(saved);
      });
      setByRole(next);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (Object.keys(byRole) as ChatRole[]).forEach((role) => {
      window.localStorage.setItem(STORAGE_KEY[role], JSON.stringify(byRole[role]));
    });
  }, [byRole, hydrated]);

  function getConversations(role: ChatRole) {
    return byRole[role];
  }

  function ensureConversation(role: ChatRole, id: string, name: string, initials: string) {
    setByRole((prev) => {
      const list = prev[role];
      if (list.some((c) => c.id === id)) return prev;
      return { ...prev, [role]: [{ id, name, initials, lastMessage: "", messages: [] }, ...list] };
    });
  }

  function sendUserMessage(role: ChatRole, conversationId: string, text: string) {
    setByRole((prev) => ({
      ...prev,
      [role]: prev[role].map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: text, messages: [...c.messages, { id: makeMessageId(), from: "me", text }] }
          : c
      ),
    }));
  }

  function sendSystemMessage(role: ChatRole, id: string, name: string, initials: string, text: string) {
    setByRole((prev) => {
      const list = prev[role];
      const msg = { id: makeMessageId(), from: "them" as const, text };
      if (list.some((c) => c.id === id)) {
        return {
          ...prev,
          [role]: list.map((c) => (c.id === id ? { ...c, lastMessage: text, messages: [...c.messages, msg] } : c)),
        };
      }
      return { ...prev, [role]: [{ id, name, initials, lastMessage: text, messages: [msg] }, ...list] };
    });
  }

  const value = useMemo(
    () => ({ getConversations, ensureConversation, sendUserMessage, sendSystemMessage }),
    [byRole]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within a ChatProvider");
  return ctx;
}
