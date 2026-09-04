"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { NotificationRow } from "@/types/supabase";

interface NotificationsContextValue {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Per-user soft clear: hides every notification from THIS user's list.
   *  Rows stay in the database (audit trail); they just stop being returned. */
  clearAll: () => Promise<void>;
  refetch: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const load = useCallback(() => setRefetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    async function fetchNotifications() {
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*, actor:profiles!actor_id(id, full_name, avatar_url)")
        .is("cleared_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load notifications.");
        setLoading(false);
        return;
      }

      setNotifications(
        ((data ?? []) as any[]).map((n: any) => ({
          id: n.id,
          school_id: n.school_id,
          recipient_id: n.recipient_id,
          actor_id: n.actor_id,
          actor_name: n.actor?.full_name ?? null,
          actor_avatar: n.actor?.avatar_url ?? null,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read_at: n.read_at,
          cleared_at: n.cleared_at,
          created_at: n.created_at,
        }))
      );
      setError(null);
      setLoading(false);
    }

    fetchNotifications();

    // Realtime: new notifications for me appear immediately.
    const channel = supabase
      .channel("notifications-mine")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          if (cancelled) return;
          setNotifications((prev) => {
            const next = payload.new as any;
            if (!next || prev.some((n) => n.id === next.id)) return prev;
            return [
              {
                id: next.id,
                school_id: next.school_id,
                recipient_id: next.recipient_id,
                actor_id: next.actor_id,
                actor_name: null,
                actor_avatar: null,
                type: next.type,
                title: next.title,
                body: next.body,
                link: next.link,
                read_at: next.read_at,
                cleared_at: next.cleared_at,
                created_at: next.created_at,
              },
              ...prev,
            ];
          });
        }
      )
      .subscribe();

    // Refresh on window focus too (catches missed realtime events).
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile, refetchTick, load]);

  const markRead = useCallback(
    async (id: string) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("recipient_id", profile.id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    },
    [profile]
  );

  const markAllRead = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    await (supabase.from("notifications") as any)
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", profile.id)
      .is("read_at", null);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }, [profile]);

  const clearAll = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    await (supabase.from("notifications") as any)
      .update({ read_at: new Date().toISOString(), cleared_at: new Date().toISOString() })
      .eq("recipient_id", profile.id);
    // Remove from state entirely - the server stops returning cleared rows.
    setNotifications([]);
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, error, markRead, markAllRead, clearAll, refetch: load }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
