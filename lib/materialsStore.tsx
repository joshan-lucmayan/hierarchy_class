"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { validateUpload, resolveFileExtension } from "@/lib/uploadUtils";
import { randomId } from "@/lib/randomId";

export interface LearningMaterial {
  id: string;
  title: string;
  subject: string;
  levelLabel: string | null;
  type: string;
  description: string | null;
  url: string | null; // signed URL when it points into storage
  storagePath: string | null;
  uploadedById: string;
  uploaderName: string | null;
  uploadDate: string;
  mine: boolean;
}

interface MaterialsContextValue {
  materials: LearningMaterial[];
  loading: boolean;
  error: string | null;
  createMaterial: (input: {
    title: string;
    subject: string;
    levelLabel: string;
    type: string;
    description: string;
    file?: File | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  deleteMaterial: (id: string) => Promise<void>;
  refresh: () => void;
}

const MaterialsContext = createContext<MaterialsContextValue | null>(null);

export function MaterialsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
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
    const myProfileId = profile.id;
    const supabase = createClient();

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("learning_materials")
        .select("*, uploader:profiles!uploaded_by(full_name)")
        .order("upload_date", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load learning materials.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      // Storage paths are stored WITHOUT the bucket prefix ("{school}/{profile}/{uuid}.ext")
      // so that storage RLS's foldername(name)[1] === school_id works. Anything that
      // doesn't start with http is a storage path; real external links start with http(s).
      const storagePaths = rows.map((r) => r.url).filter((u: string | null) => u && !u.startsWith("http"));
      const signed =
        storagePaths.length > 0
          ? await supabase.storage.from("materials").createSignedUrls(storagePaths, 3600)
          : null;
      const urlByPath: Record<string, string> = {};
      (signed?.data ?? []).forEach((s: any, i: number) => {
        if (s?.signedUrl && storagePaths[i]) urlByPath[storagePaths[i]] = s.signedUrl;
      });

      if (cancelled) return;
      setMaterials(
        rows.map((r: any) => {
          const isStorage = r.url && !r.url.startsWith("http");
          return {
            id: r.id,
            title: r.title,
            subject: r.subject,
            levelLabel: r.level_label,
            type: r.type,
            description: r.description,
            url: isStorage ? urlByPath[r.url] ?? null : r.url,
            storagePath: isStorage ? r.url : null,
            uploadedById: r.uploaded_by,
            uploaderName: r.uploader?.full_name ?? null,
            uploadDate: r.upload_date,
            mine: r.uploaded_by === myProfileId,
          };
        })
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

  const createMaterial = useCallback(
    async (input: {
      title: string;
      subject: string;
      levelLabel: string;
      type: string;
      description: string;
      file?: File | null;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!profile) return { ok: false, error: "You're not signed in. Reload the page and try again." };

      let url: string | null = null;
      if (input.file) {
        const validationError = validateUpload(input.file, "document");
        if (validationError) {
          setError(validationError);
          return { ok: false, error: validationError };
        }
        const ext = resolveFileExtension(input.file) ?? "pdf";
        // Path is relative to the "materials" bucket and MUST NOT include the
        // bucket name as a prefix — storage RLS reads the school id from
        // foldername(name)[1], so the first folder has to be the school UUID.
        const path = `${profile.school_id}/${profile.id}/${randomId()}.${ext}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("materials")
          .upload(path, input.file, { contentType: input.file.type, upsert: false });
        if (uploadError) {
          setError("Couldn't upload the file.");
          return {
            ok: false,
            error: `Couldn't upload the file: ${uploadError.message}. ${uploadError.status === 403 ? "Storage permission issue — check the materials bucket policies." : ""}`,
          };
        }
        url = path;
      }

      const supabase = createClient();
      const { error: insertError } = await supabase.from("learning_materials").insert({
        school_id: profile.school_id,
        title: input.title.trim(),
        subject: input.subject,
        level_label: input.levelLabel || null,
        type: input.type || "Document",
        uploaded_by: profile.id,
        description: input.description.trim() || null,
        url,
      } as any);

      if (insertError) {
        if (url) await supabase.storage.from("materials").remove([url]);
        setError("Couldn't save the material.");
        return {
          ok: false,
          error: `Couldn't save the material: ${insertError.message}. ${insertError.code === "42501" ? "The database rejected the insert — check the learning_materials RLS policies." : ""}`,
        };
      }

      setError(null);
      refresh();
      return { ok: true };
    },
    [profile, refresh]
  );

  const deleteMaterial = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const existing = materials.find((m) => m.id === id);
      await supabase.from("learning_materials").delete().eq("id", id);
      if (existing?.storagePath) {
        await supabase.storage.from("materials").remove([existing.storagePath]);
      }
      refresh();
    },
    [materials, refresh]
  );

  return (
    <MaterialsContext.Provider value={{ materials, loading, error, createMaterial, deleteMaterial, refresh }}>
      {children}
    </MaterialsContext.Provider>
  );
}

export function useMaterials() {
  const ctx = useContext(MaterialsContext);
  if (!ctx) throw new Error("useMaterials must be used within MaterialsProvider");
  return ctx;
}
