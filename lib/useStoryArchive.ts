"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { randomId } from "@/lib/randomId";

/**
 * Story Archive — the student's own previously-posted MyDay stories.
 *
 * The live feed (lib/storiesStore.tsx) only loads stories that have not yet
 * expired (`expires_at > now()`). This hook loads the SAME `stories` table but
 * includes the owner's expired entries too — the RLS policy in migration 015
 * already allows an owner to read their own stories regardless of expiry, so
 * nothing here reaches outside the existing data model. No fake data, no new
 * tables: the archive is the student's real story history.
 *
 * Storage images live in the private "myday" bucket, so paths are always
 * signed on read, exactly like the live feed.
 */

export interface ArchivedStory {
  id: string;
  imageUrl: string;
  imagePath: string;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
}

interface UseStoryArchiveResult {
  stories: ArchivedStory[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useStoryArchive(): UseStoryArchiveResult {
  const { profile } = useMyProfile();
  const [stories, setStories] = useState<ArchivedStory[]>([]);
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
    const myProfileId = profile.id;

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("stories")
        .select("id, user_id, image_path, caption, created_at, expires_at")
        .eq("user_id", myProfileId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load your story archive.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const paths = rows.map((r) => r.image_path).filter(Boolean);
      const signed = await supabase.storage.from("myday").createSignedUrls(paths, 3600);
      const urlByPath: Record<string, string> = {};
      (signed.data ?? []).forEach((s: any, i: number) => {
        if (s?.signedUrl && paths[i]) urlByPath[paths[i]] = s.signedUrl;
      });

      if (cancelled) return;
      setStories(
        rows.map((r: any) => ({
          id: r.id,
          imageUrl: urlByPath[r.image_path] ?? "",
          imagePath: r.image_path,
          caption: r.caption,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
        }))
      );
      setError(null);
      setLoading(false);
    }

    load();

    // Keep the archive live: deleting a story (or a new one expiring) should
    // refresh the list while the modal is open.
    const channel = supabase
      .channel(`story-archive-${randomId()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories", filter: `user_id=eq.${myProfileId}` },
        () => {
          if (!cancelled) setRefetchTick((t) => t + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refresh = useCallback(() => setRefetchTick((t) => t + 1), []);

  return { stories, loading, error, refresh };
}
