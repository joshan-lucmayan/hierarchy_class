"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { validateUpload, extensionForMime } from "@/lib/uploadUtils";
import { randomId } from "@/lib/randomId";
import { notifyPostAudience } from "@/lib/notify";

export interface SchoolPost {
  id: string;
  type: "post" | "announcement";
  tag: string;
  title: string | null;
  body: string;
  audience: "everyone" | "students" | "teachers";
  imageUrl: string | null;
  imagePath: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorId: string | null;
  /** Author's profile role ("admin" / "teacher" / "student") - presentation only. */
  authorRole: string | null;
  createdAt: string;
}

interface SchoolFeedContextValue {
  posts: SchoolPost[];
  loading: boolean;
  error: string | null;
  createPost: (input: {
    type: "post" | "announcement";
    title: string;
    body: string;
    tag: string;
    audience: "everyone" | "students" | "teachers";
    image?: File | null;
    notifyAudience: boolean;
  }) => Promise<string | null>;
  updatePost: (id: string, patch: { type: "post" | "announcement"; title: string; body: string; tag: string; audience: "everyone" | "students" | "teachers"; image?: File | null; notifyAudience: boolean }) => Promise<boolean>;
  deletePost: (id: string) => Promise<void>;
  refresh: () => void;
}

const SchoolFeedContext = createContext<SchoolFeedContextValue | null>(null);

export function SchoolFeedProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [posts, setPosts] = useState<SchoolPost[]>([]);
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

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("school_feed_posts")
        .select("*, author:profiles!author_id(id, full_name, avatar_url, role)")
        .order("created_at", { ascending: false })
        .limit(40);

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load the school feed.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const paths = rows.map((r) => r.image_path).filter(Boolean);
      const signed = paths.length > 0 ? await supabase.storage.from("feed").createSignedUrls(paths, 3600) : null;
      const urlByPath: Record<string, string> = {};
      (signed?.data ?? []).forEach((s: any, i: number) => {
        if (s?.signedUrl && paths[i]) urlByPath[paths[i]] = s.signedUrl;
      });

      if (cancelled) return;
      setPosts(
        rows.map((r: any) => ({
          id: r.id,
          type: r.post_type ?? "post",
          tag: r.tag,
          title: r.title,
          body: r.body,
          audience: r.audience ?? "everyone",
          imageUrl: r.image_path ? urlByPath[r.image_path] ?? null : null,
          imagePath: r.image_path,
          authorName: r.author?.full_name ?? null,
          authorAvatar: r.author?.avatar_url ?? null,
          authorId: r.author?.id ?? null,
          authorRole: r.author?.role ?? null,
          createdAt: r.created_at,
        }))
      );
      setError(null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refresh = useCallback(() => setRefetchTick((t) => t + 1), []);

  async function uploadImage(file: File, schoolId: string): Promise<string | null> {
    const validationError = validateUpload(file, "image");
    if (validationError) {
      setError(validationError);
      return null;
    }
    const ext = extensionForMime(file.type) ?? "jpg";
    const path = `${schoolId}/${randomId()}.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("feed")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError("Couldn't upload the post image.");
      return null;
    }
    return path;
  }

  const createPost = useCallback(
    async (input: {
      type: "post" | "announcement";
      title: string;
      body: string;
      tag: string;
      audience: "everyone" | "students" | "teachers";
      image?: File | null;
      notifyAudience: boolean;
    }): Promise<string | null> => {
      if (!profile) return null;

      let imagePath: string | null = null;
      if (input.image) {
        imagePath = await uploadImage(input.image, profile.school_id);
        if (!imagePath) return null;
      }

      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("school_feed_posts")
        .insert({
          school_id: profile.school_id,
          post_type: input.type,
          tag: input.tag || "General",
          title: input.title.trim() || null,
          body: input.body.trim(),
          audience: input.audience,
          image_path: imagePath,
          author_id: profile.id,
        } as any)
        .select("id")
        .single();

      if (insertError) {
        if (imagePath) await supabase.storage.from("feed").remove([imagePath]);
        setError("Couldn't publish the post.");
        return null;
      }

      if (input.notifyAudience) {
        await notifyPostAudience((data as any)?.id);
      }

      setError(null);
      refresh();
      return (data as any)?.id ?? null;
    },
    [profile, refresh]
  );

  const updatePost = useCallback(
    async (
      id: string,
      patch: { type: "post" | "announcement"; title: string; body: string; tag: string; audience: "everyone" | "students" | "teachers"; image?: File | null; notifyAudience: boolean }
    ): Promise<boolean> => {
      if (!profile) return false;

      let imagePath: string | null = null;
      if (patch.image) {
        imagePath = await uploadImage(patch.image, profile.school_id);
        if (!imagePath) return false;
      }

      const supabase = createClient();
      const existing = posts.find((p) => p.id === id);
      const payload: Record<string, unknown> = {
        post_type: patch.type,
        title: patch.title.trim() || null,
        body: patch.body.trim(),
        tag: patch.tag,
        audience: patch.audience,
        updated_at: new Date().toISOString(),
      };
      if (imagePath) payload.image_path = imagePath;

      const { error: updateError } = await (supabase.from("school_feed_posts") as any)
        .update(payload)
        .eq("id", id);

      if (updateError) {
        if (imagePath) await supabase.storage.from("feed").remove([imagePath]);
        setError("Couldn't update the post.");
        return false;
      }

      // Old image no longer referenced - clean it up.
      if (imagePath && existing?.imagePath && existing.imagePath !== imagePath) {
        await supabase.storage.from("feed").remove([existing.imagePath]);
      }

      if (patch.notifyAudience) {
        await notifyPostAudience(id);
      }

      setError(null);
      refresh();
      return true;
    },
    [profile, posts, refresh]
  );

  const deletePost = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const existing = posts.find((p) => p.id === id);
      await supabase.from("school_feed_posts").delete().eq("id", id);
      if (existing?.imagePath) {
        await supabase.storage.from("feed").remove([existing.imagePath]);
      }
      refresh();
    },
    [posts, refresh]
  );

  return (
    <SchoolFeedContext.Provider
      value={{ posts, loading, error, createPost, updatePost, deletePost, refresh }}
    >
      {children}
    </SchoolFeedContext.Provider>
  );
}

export function useSchoolFeed() {
  const ctx = useContext(SchoolFeedContext);
  if (!ctx) throw new Error("useSchoolFeed must be used within SchoolFeedProvider");
  return ctx;
}
