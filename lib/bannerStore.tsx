"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_IMAGE = "hc-banner-image";
const STORAGE_FOCAL_Y = "hc-banner-focal-y";

export const DEFAULT_BANNER_IMAGE = "/brand/bg-nhd.png";
export const DEFAULT_BANNER_FOCAL_Y = 66;

interface BannerContextValue {
  imageUrl: string;
  focalY: number;
  isCustom: boolean;
  setBannerImage: (dataUrl: string) => void;
  setFocalY: (y: number) => void;
  resetBanner: () => void;
}

const BannerContext = createContext<BannerContextValue | null>(null);

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_BANNER_IMAGE);
  const [focalY, setFocalYState] = useState<number>(DEFAULT_BANNER_FOCAL_Y);
  const [isCustom, setIsCustom] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedImage = window.localStorage.getItem(STORAGE_IMAGE);
      const savedFocalY = window.localStorage.getItem(STORAGE_FOCAL_Y);
      if (savedImage) {
        setImageUrl(savedImage);
        setIsCustom(true);
      }
      if (savedFocalY) setFocalYState(Number(savedFocalY));
    } catch {
      // ignore corrupted/unavailable storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (isCustom) {
        window.localStorage.setItem(STORAGE_IMAGE, imageUrl);
      } else {
        window.localStorage.removeItem(STORAGE_IMAGE);
      }
      window.localStorage.setItem(STORAGE_FOCAL_Y, String(focalY));
    } catch {
      // ignore storage write failures (e.g. quota exceeded)
    }
  }, [imageUrl, focalY, isCustom, hydrated]);

  function setBannerImage(dataUrl: string) {
    setImageUrl(dataUrl);
    setIsCustom(true);
    setFocalYState(50);
  }

  function setFocalY(y: number) {
    setFocalYState(Math.max(0, Math.min(100, y)));
  }

  function resetBanner() {
    setImageUrl(DEFAULT_BANNER_IMAGE);
    setFocalYState(DEFAULT_BANNER_FOCAL_Y);
    setIsCustom(false);
  }

  return (
    <BannerContext.Provider value={{ imageUrl, focalY, isCustom, setBannerImage, setFocalY, resetBanner }}>
      {children}
    </BannerContext.Provider>
  );
}

export function useBanner() {
  const ctx = useContext(BannerContext);
  if (!ctx) throw new Error("useBanner must be used within BannerProvider");
  return ctx;
}
