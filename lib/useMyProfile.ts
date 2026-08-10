"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";

interface UseMyProfileResult {
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  updateProfile: (patch: Partial<Pick<ProfileRow, "bio" | "favorite_subject" | "hobbies" | "interests" | "tags">>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

/** Fetches the profile row belonging to the currently logged in user. */
export function useMyProfile(): UseMyProfileResult {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
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

    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: userData, error: userError }) => {
      if (cancelled) return;
      if (userError || !userData.user) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (cancelled) return;
      if (profileError || !data) {
        setError("Couldn't load your profile.");
        setProfile(null);
      } else {
        setProfile(data as ProfileRow);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<ProfileRow, "bio" | "favorite_subject" | "hobbies" | "interests" | "tags">>) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("profiles") as any).update(patch).eq("id", profile.id);
      refetch();
    },
    [profile, refetch]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!profile) return;
      const supabase = createClient();

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) return;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      await (supabase.from("profiles") as any).update({ avatar_url: avatarUrl }).eq("id", profile.id);
      refetch();
    },
    [profile, refetch]
  );

  const removeAvatar = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    await (supabase.from("profiles") as any).update({ avatar_url: null }).eq("id", profile.id);
    refetch();
  }, [profile, refetch]);

  return { profile, loading, error, updateProfile, uploadAvatar, removeAvatar };
}
