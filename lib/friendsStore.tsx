"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

export interface Friend {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  levelLabel: string | null;
  section: string | null;
}

interface FriendsContextValue {
  friends: Friend[];
  friendIds: string[];
  loading: boolean;
  error: string | null;
  addFriend: (profileId: string) => Promise<void>;
  removeFriend: (profileId: string) => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("friends")
      .select("*, a:profiles!user_a_id(id, full_name, avatar_url, level_label, section, deactivated_at), b:profiles!user_b_id(id, full_name, avatar_url, level_label, section, deactivated_at)")
      .or(`user_a_id.eq.${profile.id},user_b_id.eq.${profile.id}`)
      .then(({ data, error: fetchError }: any) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load your friends. Please refresh and try again.");
          setFriends([]);
        } else {
          setFriends(
            ((data ?? []) as any[])
              // Deactivated accounts aren't available for normal interaction.
              .filter((row) => {
                const other = row.user_a_id === profile.id ? row.b : row.a;
                return !other?.deactivated_at;
              })
              .map((row) => {
                const other = row.user_a_id === profile.id ? row.b : row.a;
                return {
                  id: other.id,
                  fullName: other.full_name,
                  avatarUrl: other.avatar_url,
                  levelLabel: other.level_label,
                  section: other.section,
                };
              })
          );
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const addFriend = useCallback(
    async (profileId: string) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("friends") as any).insert({
        school_id: profile.school_id,
        user_a_id: profile.id,
        user_b_id: profileId,
      });
      refetch();
    },
    [profile, refetch]
  );

  const removeFriend = useCallback(
    async (profileId: string) => {
      if (!profile) return;
      const supabase = createClient();
      await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_a_id.eq.${profile.id},user_b_id.eq.${profileId}),and(user_a_id.eq.${profileId},user_b_id.eq.${profile.id})`
        );
      refetch();
    },
    [profile, refetch]
  );

  const friendIds = friends.map((f) => f.id);

  return (
    <FriendsContext.Provider value={{ friends, friendIds, loading, error, addFriend, removeFriend }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriendsStore() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriendsStore must be used within FriendsProvider");
  return ctx;
}
