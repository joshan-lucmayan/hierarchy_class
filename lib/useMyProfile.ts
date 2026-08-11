"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";
import { validateUpload, extensionForMime, storagePathFromUrl } from "@/lib/uploadUtils";

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

      // Validate BEFORE touching storage: MIME whitelist, size cap, and the
      // extension is derived from the MIME type, never from the file name.
      const validationError = validateUpload(file, "image");
      if (validationError) {
        setError(validationError);
        return;
      }

      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const ext = extensionForMime(file.type) ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const prevPath = profile.avatar_url ? storagePathFromUrl(profile.avatar_url, "avatars") : null;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        setError("Couldn't upload your profile picture.");
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      await (supabase.from("profiles") as any).update({ avatar_url: avatarUrl }).eq("id", profile.id);

      // Remove the superseded image so no orphaned objects accumulate.
      if (prevPath && prevPath !== path) {
        await supabase.storage.from("avatars").remove([prevPath]);
      }

      setError(null);
      refetch();
    },
    [profile, refetch]
  );

  const removeAvatar = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const prevPath = profile.avatar_url ? storagePathFromUrl(profile.avatar_url, "avatars") : null;
    await (supabase.from("profiles") as any).update({ avatar_url: null }).eq("id", profile.id);
    // Delete the stored object so the default avatar takes over with no
    // orphaned image left in storage.
    if (prevPath) {
      await supabase.storage.from("avatars").remove([prevPath]);
    }
    refetch();
  }, [profile, refetch]);

  return { profile, loading, error, updateProfile, uploadAvatar, removeAvatar };
}
