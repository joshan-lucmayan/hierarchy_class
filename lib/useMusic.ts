"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentMusicRow } from "@/types/supabase";
import type { ResolvedMusic } from "@/lib/musicTypes";
import { createClient } from "@/lib/supabase/client";
import { backendUrl } from "@/lib/siteUrl";

export interface MusicProfile {
  id: string;
  school_id: string;
}

/**
 * Student music posts (post by link). Metadata is resolved server-side by
 * `/api/resolve-music` (keyless oEmbed for YouTube/SoundCloud/Vimeo/Apple
 * Music, OAuth client-credentials for Spotify) and only the resolved values
 * are persisted - the student never types a title, artist, or cover. RLS
 * enforces owner insert/delete and same-school reads.
 */
export function useMusic(studentId?: string | null) {
  const [music, setMusic] = useState<StudentMusicRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured || !studentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    supabase
      .from("student_music")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setMusic((data ?? []) as StudentMusicRow[]);
        setError(err ? "Couldn't load music." : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, studentId, refetchTick]);

  const create = useCallback(async (meta: ResolvedMusic, profile: MusicProfile) => {
    const supabase = createClient();
    // Inserts are cast `as any` codebase-wide (supabase-js types `.insert()`
    // as never[] for object literals); RLS still gates the write.
    const { error: insertError } = await (supabase.from("student_music") as any).insert({
      student_id: profile.id,
      school_id: profile.school_id,
      music_url: meta.url,
      platform: meta.platform,
      title: meta.title,
      artist: meta.artist ?? "Unknown artist",
      album_cover_url: meta.coverUrl,
    });
    if (insertError) return { error: "Couldn't save your music." };
    setRefetchTick((t) => t + 1);
    return { error: null };
  }, []);

  const remove = useCallback(async (item: StudentMusicRow) => {
    const supabase = createClient();
    await supabase.from("student_music").delete().eq("id", item.id).eq("student_id", item.student_id);
    setRefetchTick((t) => t + 1);
  }, []);

  return { music, loading, error, create, remove };
}

/**
 * Resolves a music link through the server route. Throws with a user-facing
 * message on any failure so the UI can show it directly.
 */
export async function resolveMusicUrl(url: string): Promise<ResolvedMusic> {
  const res = await fetch(backendUrl("/api/resolve-music"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: ResolvedMusic; error?: string } | null;
  if (!json?.ok || !json.data) {
    throw new Error(json?.error ?? "Music information could not be retrieved.");
  }
  return json.data;
}
