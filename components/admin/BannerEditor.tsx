"use client";

import { useRef, useState } from "react";
import { useBanner } from "@/lib/bannerStore";

export function BannerEditor() {
  const { imageUrl, focalY, isCustom, loading, error, setBannerImage, setFocalY, resetBanner } = useBanner();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startFocal: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerImage(file);
    e.target.value = "";
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = { startY: e.clientY, startFocal: focalY };
    setDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragState.current || !frameRef.current) return;
    const frameHeight = frameRef.current.getBoundingClientRect().height;
    const deltaY = e.clientY - dragState.current.startY;
    // Dragging down should reveal more of the top of the photo (focal point moves up),
    // matching how Facebook's cover photo reposition drag feels.
    const deltaPct = (deltaY / frameHeight) * 100;
    setFocalY(dragState.current.startFocal - deltaPct);
  }

  function handlePointerUp() {
    if (dragState.current) {
      // Persist the final focal point once dragging stops.
      setFocalY(focalY);
    }
    dragState.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-navy">Header banner</p>
        <p className="mt-1 text-xs text-muted">
          Upload a new banner for the top of every page - swap it for holidays, events, or campaigns. Drag the photo below up or down to choose what shows in the thin header strip, just like repositioning a Facebook cover photo.
        </p>
      </div>

      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        className={`relative h-40 w-full touch-none select-none overflow-hidden rounded-[10px] border ${dragging ? "border-gold" : "border-base"}`}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <img
          src={imageUrl}
          alt="Banner preview"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `center ${focalY}%` }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-8 -translate-y-1/2 border-y border-dashed border-white/50" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
          Drag to reposition
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-muted">Fine-tune position</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(focalY)}
          onChange={(e) => setFocalY(Number(e.target.value))}
          className="w-full accent-gold"
        />
      </label>

      {loading && <p className="text-xs text-muted">Loading banner...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full bg-navy px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
        >
          Upload new banner
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={resetBanner}
            className="rounded-full border border-base bg-surface px-4 py-2.5 text-xs font-semibold text-navy transition hover:border-red-400 hover:text-red-600"
          >
            Reset to default
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <p className="text-[11px] text-muted">
        This preview is taller than the real header so it&apos;s easier to drag, but the position you choose maps directly to the live site - every page, every role.
      </p>
    </div>
  );
}
