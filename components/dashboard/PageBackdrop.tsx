"use client";

import { useShop } from "@/lib/shopStore";

/**
 * Fixed full-screen backdrop for app pages, in the same cinematic spirit as the
 * landing page. Lets the page cards sit translucent above a decorative image.
 *
 * Driven by the Florin shop: the student's equipped background renders here.
 * With nothing equipped the backdrop is not rendered at all, so the page shows
 * the flat token background - that flat surface is the system default, and
 * every new student starts on it until they buy and equip a background.
 */
export function PageBackdrop() {
  const { equippedBackground } = useShop();
  const src = equippedBackground?.image_url;

  if (!src) return null;

  return (
    <div className="page-bg pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* The decorative image, static - no motion on the app pages */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${src})`,
        }}
      />

      {/* Readability overlay: the page token tinted (strength is theme-aware
          via --backdrop-tint, so light themes don't wash the art to white) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg) var(--backdrop-tint), transparent)",
        }}
      />

      {/* Soft vignette so edges read cleanly behind the sidebar and header */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 45%, color-mix(in srgb, var(--bg) 85%, transparent) 100%)",
        }}
      />
    </div>
  );
}
