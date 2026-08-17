"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentAchievementRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";
import { validateUpload, extensionForMime, storagePathFromUrl } from "@/lib/uploadUtils";

export interface CreateAchievementInput {
  title: string;
  school_year: string;
  date_awarded: string; // YYYY-MM-DD
  school: string;
  image: File;
}

export interface AchievementProfile {
  id: string;
  school_id: string;
}

/**
 * Student achievements for a profile. The certificate image follows the
 * avatar storage pattern: validated client-side, uploaded to the public
 * `certificates` bucket under the authenticated user's own folder, then the
 * row is inserted with the public URL. If the row insert fails the uploaded
 * object is removed so no orphaned images accumulate; deleting a row also
 * removes its certificate object.
 *
 * RLS enforces ownership (student_id must be the caller's own profile) and
 * same-school reads; the client never sets student_id from a request.
 */
export function useAchievements(studentId?: string | null) {
  const [achievements, setAchievements] = useState<StudentAchievementRow[]>([]);
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
      .from("student_achievements")
      .select("*")
      .eq("student_id", studentId)
      .order("date_awarded", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setAchievements((data ?? []) as StudentAchievementRow[]);
        setError(err ? "Couldn't load achievements." : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, studentId, refetchTick]);

  const create = useCallback(async (input: CreateAchievementInput, profile: AchievementProfile) => {
    // Validate BEFORE touching storage: MIME whitelist, extension derived from
    // the MIME type, and the certificate-specific 10 MB cap (the shared image
    // default stays 5 MB for avatars/feed/stories/etc.).
    const validationError = validateUpload(input.image, "image", {
      maxSizeMB: 10,
      sizeError: "Certificate image must be 10 MB or smaller.",
    });
    if (validationError) return { error: validationError };

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { error: "Not signed in." };

    const ext = extensionForMime(input.image.type) ?? "jpg";
    const path = `${userId}/cert-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(path, input.image, { contentType: input.image.type, upsert: true });

    if (uploadError) {
      return { error: "Couldn't upload your certificate image." };
    }

    const { data: publicUrlData } = supabase.storage.from("certificates").getPublicUrl(path);
    const imagePath = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    // Note: the project's supabase-js version types `.insert()` as `never[]`
    // for object literals on every table, so inserts are cast `as any`
    // codebase-wide (see classroomHierarchyStore) - RLS still gates the write.
    const { error: insertError } = await (supabase.from("student_achievements") as any).insert({
      student_id: profile.id,
      school_id: profile.school_id,
      title: input.title.trim(),
      school_year: input.school_year.trim(),
      date_awarded: input.date_awarded,
      school: input.school.trim(),
      image_path: imagePath,
    });

    if (insertError) {
      // Don't leave an orphaned certificate behind when the row insert fails.
      await supabase.storage.from("certificates").remove([path]);
      return { error: "Couldn't save your achievement." };
    }

    setRefetchTick((t) => t + 1);
    return { error: null };
  }, []);

  const remove = useCallback(async (achievement: StudentAchievementRow) => {
    const supabase = createClient();
    await supabase
      .from("student_achievements")
      .delete()
      .eq("id", achievement.id)
      .eq("student_id", achievement.student_id);
    // Remove the certificate object so no orphaned images accumulate.
    const path = achievement.image_path ? storagePathFromUrl(achievement.image_path, "certificates") : null;
    if (path) {
      await supabase.storage.from("certificates").remove([path]);
    }
    setRefetchTick((t) => t + 1);
  }, []);

  return { achievements, loading, error, create, remove };
}
