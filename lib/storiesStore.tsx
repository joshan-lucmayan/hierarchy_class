"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { validateUpload, extensionForMime } from "@/lib/uploadUtils";
import { randomId } from "@/lib/randomId";
import type { StoryRow, StoryViewRow } from "@/types/supabase";

export interface Story {
  id: string;
  userId: string;
  imageUrl: string;
  imagePath: string;
  caption: string | null;
  mentionIds: string[];
  createdAt: string;
  expiresAt: string;
  authorName: string | null;
  authorAvatar: string | null;
}

export interface StoryViewer {
  id: string;
  name: string;
  avatarUrl: string | null;
  viewedAt: string;
}

interface StoriesContextValue {
  stories: Story[];
  loading: boolean;
  error: string | null;
  viewers: Record<string, StoryViewer[]>;
  createStory: (file: File, caption?: string, mentionIds?: string[]) => Promise<string | null>;
  deleteStory: (storyId: string) => Promise<void>;
  recordView: (storyId: string) => Promise<void>;
  refresh: () => void;
}

const StoriesContext = createContext<StoriesContextValue | null>(null);

export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Record<string, StoryViewer[]>>({});
  const [refetchTick, setRefetchTick] = useState(0);
  const [viewed, setViewed] = useState<Set<string>>(new Set());

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
    const myProfileId = profile.id;
    const supabase = createClient();

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("stories")
        .select("*, author:profiles!user_id(id, full_name, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load stories.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      // Sign the private storage URLs.
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
          userId: r.user_id,
          imageUrl: urlByPath[r.image_path] ?? "",
          imagePath: r.image_path,
          caption: r.caption,
          mentionIds: r.mention_ids ?? [],
          createdAt: r.created_at,
          expiresAt: r.expires_at,
          authorName: r.author?.full_name ?? null,
          authorAvatar: r.author?.avatar_url ?? null,
        }))
      );
      setError(null);
      setLoading(false);

      // Load viewers for my own stories.
      const mine = rows.filter((r: any) => r.user_id === myProfileId).map((r: any) => r.id);
      if (mine.length > 0) {
        const { data: viewData } = await supabase
          .from("story_views")
          .select("*, viewer:profiles!viewer_id(id, full_name, avatar_url)")
          .in("story_id", mine)
          .order("viewed_at", { ascending: true });

        const byStory: Record<string, StoryViewer[]> = {};
        ((viewData ?? []) as any[]).forEach((v: any) => {
          (byStory[v.story_id] ??= []).push({
            id: v.viewer_id,
            name: v.viewer?.full_name ?? "Unknown",
            avatarUrl: v.viewer?.avatar_url ?? null,
            viewedAt: v.viewed_at,
          });
        });
        if (!cancelled) setViewers(byStory);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refresh = useCallback(() => setRefetchTick((t) => t + 1), []);

  const createStory = useCallback(
    async (file: File, caption?: string, mentionIds?: string[]): Promise<string | null> => {
      if (!profile) return null;

      const validationError = validateUpload(file, "image");
      if (validationError) {
        setError(validationError);
        return null;
      }

      const ext = extensionForMime(file.type) ?? "jpg";
      const path = `${profile.school_id}/${profile.id}/${randomId()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("myday")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError("Couldn't upload your story image.");
        return null;
      }

      const { data, error: insertError } = await supabase
        .from("stories")
        .insert({
          school_id: profile.school_id,
          user_id: profile.id,
          image_path: path,
          caption: caption?.trim() ? caption.trim() : null,
          mention_ids: mentionIds ?? [],
        } as any)
        .select("id")
        .single();

      if (insertError) {
        await supabase.storage.from("myday").remove([path]);
        setError("Couldn't save your story.");
        return null;
      }

      setError(null);
      refresh();
      return (data as any)?.id ?? null;
    },
    [profile, refresh]
  );

  const deleteStory = useCallback(
    async (storyId: string) => {
      const supabase = createClient();
      const story = stories.find((s) => s.id === storyId);
      await supabase.from("stories").delete().eq("id", storyId);
      // Remove the stored image so no orphaned object is left behind.
      if (story?.imagePath) {
        await supabase.storage.from("myday").remove([story.imagePath]);
      }
      refresh();
    },
    [stories, refresh]
  );

  const recordView = useCallback(
    async (storyId: string) => {
      if (!profile || viewed.has(storyId)) return;
      // De-dupe at the client and let the DB UNIQUE(story_id, viewer_id) handle races.
      setViewed((prev) => new Set(prev).add(storyId));
      const supabase = createClient();
      await supabase
        .from("story_views")
        .insert({ story_id: storyId, viewer_id: profile.id } as any)
        .select("id")
        .single();
    },
    [profile, viewed]
  );

  return (
    <StoriesContext.Provider
      value={{ stories, loading, error, viewers, createStory, deleteStory, recordView, refresh }}
    >
      {children}
    </StoriesContext.Provider>
  );
}

export function useStories() {
  const ctx = useContext(StoriesContext);
  if (!ctx) throw new Error("useStories must be used within StoriesProvider");
  return ctx;
}
