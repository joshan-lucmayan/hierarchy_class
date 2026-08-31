"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStoryArchive, type ArchivedStory } from "@/lib/useStoryArchive";
import { createClient } from "@/lib/supabase/client";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { IconX } from "@/components/ui/icons";
import { registerBackHandler } from "@/lib/nativeBackHandler";

/**
 * Story Archive — a student's own past MyDay stories.
 *
 * Rendered inside the profile's three-dot menu (own profile) as a modal,
 * matching the Season History pattern. Shows the real story history from the
 * existing `stories` table (including expired entries, which the RLS in
 * migration 015 already lets the owner read). Thumbnails open a simple
 * full-image viewer; owners can delete an archived story (the same delete
 * path the live feed uses).
 */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StoryLightbox({
  story,
  onClose,
}: {
  story: ArchivedStory;
  onClose: () => void;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex flex-col bg-black/90"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-medium text-white/80">
          {story.caption || "Story"}
        </p>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <IconX size={18} />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <img src={story.imageUrl} alt={story.caption ?? "Story"} className="max-h-full max-w-full object-contain" />
      </div>
      <p className="pb-6 text-center text-xs text-white/60">{formatDate(story.createdAt)}</p>
    </div>,
    document.body
  );
}

export function StoryArchive() {
  const { stories, loading, error, refresh } = useStoryArchive();
  const [open, setOpen] = useState<ArchivedStory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Android hardware back closes the lightbox first.
  useEffect(() => {
    if (!open) return;
    return registerBackHandler(() => {
      setOpen(null);
      return true;
    });
  }, [open]);

  async function handleDelete(storyId: string) {
    setDeletingId(storyId);
    setDeleteError(null);
    try {
      const supabase = createClient();
      await supabase.from("stories").delete().eq("id", storyId);
      if (open?.id === storyId) setOpen(null);
      refresh();
    } catch {
      setDeleteError("Couldn't delete that story. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-navy">Story archive</h2>
      <p className="mb-4 text-xs text-muted">Your past MyDay stories.</p>

      {loading ? (
        <p className="text-sm text-muted">Loading your stories...</p>
      ) : error ? (
        <p className="text-sm text-warn">{error}</p>
      ) : stories.length === 0 ? (
        <p className="text-sm text-muted">No stories yet — share your day and it will be archived here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stories.map((story) => (
            <div
              key={story.id}
              className="group relative overflow-hidden rounded-[10px] border border-base bg-surface"
            >
              <button
                type="button"
                onClick={() => setOpen(story)}
                title={story.caption ?? "View story"}
                aria-label={story.caption ?? "View story"}
                className="block aspect-square w-full overflow-hidden bg-tile"
              >
                {story.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={story.imageUrl} alt={story.caption ?? "Story"} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-faint">Unavailable</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(story.id)}
                disabled={deletingId === story.id}
                title="Delete story"
                aria-label="Delete story"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-base bg-surface text-muted shadow-sm transition hover:border-warn-soft hover:text-warn disabled:opacity-60"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                </svg>
              </button>
              <p className="truncate border-t border-base px-2 py-1 text-[10px] text-faint">
                {formatDate(story.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {deleteError && <p className="mt-3 text-xs text-warn">{deleteError}</p>}

      {open && <StoryLightbox story={open} onClose={() => setOpen(null)} />}
    </CornerFrame>
  );
}
