"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { validateUpload, extensionForMime } from "@/lib/uploadUtils";

export const DEFAULT_BANNER_IMAGE = "/brand/bg-nhd.png";
export const DEFAULT_BANNER_FOCAL_Y = 66;

interface BannerContextValue {
  imageUrl: string;
  focalY: number;
  isCustom: boolean;
  loading: boolean;
  error: string | null;
  setBannerImage: (file: File) => Promise<void>;
  setFocalY: (y: number) => Promise<void>;
  resetBanner: () => Promise<void>;
  refresh: () => void;
}

const BannerContext = createContext<BannerContextValue | null>(null);

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_BANNER_IMAGE);
  const [focalY, setFocalYState] = useState<number>(DEFAULT_BANNER_FOCAL_Y);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const mySchoolId = profile.school_id;
    const supabase = createClient();

    async function load() {
      const { data, error: fetchError } = await (supabase.from("banner_config") as any)
        .select("*")
        .eq("school_id", mySchoolId)
        .maybeSingle();

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load the banner.");
        setLoading(false);
        return;
      }

      if (data?.image_url) {
        const signed = await supabase.storage.from("banners").createSignedUrl(data.image_url, 3600);
        if (cancelled) return;
        setImageUrl(signed.data?.signedUrl ?? DEFAULT_BANNER_IMAGE);
        setIsCustom(true);
      } else {
        setImageUrl(DEFAULT_BANNER_IMAGE);
        setIsCustom(false);
      }
      setFocalYState(data?.focal_y ?? DEFAULT_BANNER_FOCAL_Y);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refresh = useCallback(() => setRefetchTick((t) => t + 1), []);

  async function saveConfig(patch: Record<string, unknown>) {
    if (!profile) return;
    const supabase = createClient();
    const { error } = await (supabase.from("banner_config") as any)
      .upsert(
        { school_id: profile.school_id, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "school_id" }
      );
    if (error) setError("Couldn't save the banner.");
  }

  const setBannerImage = useCallback(
    async (file: File) => {
      if (!profile) return;
      const validationError = validateUpload(file, "image");
      if (validationError) {
        setError(validationError);
        return;
      }
      const ext = extensionForMime(file.type) ?? "jpg";
      const path = `${profile.school_id}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();

      // Load the previous image path so we can remove it on success.
      const { data: prev } = await (supabase.from("banner_config") as any)
        .select("image_url")
        .eq("school_id", profile.school_id)
        .maybeSingle();

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError("Couldn't upload the banner image.");
        return;
      }

      await saveConfig({ image_url: path, focal_y: Math.round(focalY) });
      if ((prev as any)?.image_url) {
        await supabase.storage.from("banners").remove([(prev as any).image_url]);
      }
      setError(null);
      refresh();
    },
    [profile, focalY, refresh] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setFocalY = useCallback(
    async (y: number) => {
      const clamped = Math.max(0, Math.min(100, y));
      setFocalYState(clamped);
      if (isCustom && profile) {
        await saveConfig({ focal_y: Math.round(clamped) });
      }
    },
    [isCustom, profile] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const resetBanner = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const { data: prev } = await (supabase.from("banner_config") as any)
      .select("image_url")
      .eq("school_id", profile.school_id)
      .maybeSingle();
    await (supabase.from("banner_config") as any)
      .upsert(
        { school_id: profile.school_id, image_url: null, focal_y: DEFAULT_BANNER_FOCAL_Y, updated_at: new Date().toISOString() },
        { onConflict: "school_id" }
      );
    if ((prev as any)?.image_url) {
      await supabase.storage.from("banners").remove([(prev as any).image_url]);
    }
    setImageUrl(DEFAULT_BANNER_IMAGE);
    setFocalYState(DEFAULT_BANNER_FOCAL_Y);
    setIsCustom(false);
  }, [profile]);

  return (
    <BannerContext.Provider
      value={{ imageUrl, focalY, isCustom, loading, error, setBannerImage, setFocalY, resetBanner, refresh }}
    >
      {children}
    </BannerContext.Provider>
  );
}

export function useBanner() {
  const ctx = useContext(BannerContext);
  if (!ctx) throw new Error("useBanner must be used within BannerProvider");
  return ctx;
}
