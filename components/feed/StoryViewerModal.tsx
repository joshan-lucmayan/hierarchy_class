"use client";

import { useEffect, useMemo, useState } from "react";
import { useStories, Story } from "@/lib/storiesStore";
import { useMyProfile } from "@/lib/useMyProfile";

interface StoryViewerModalProps {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
}

export function StoryViewerModal({ stories, startIndex, onClose }: StoryViewerModalProps) {
  const { profile } = useMyProfile();
  const { recordView, viewers, deleteStory } = useStories();
  const [index, setIndex] = useState(startIndex);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  const story = stories[index];

  useEffect(() => {
    if (!story) return;
    if (story.userId !== profile?.id) {
      recordView(story.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const storyViewers = story ? viewers[story.id] ?? [] : [];
  const isOwner = story?.userId === profile?.id;

  const mentionNames = useMemo(() => {
    if (!story || story.mentionIds.length === 0) return [] as string[];
    // Resolve mention names from the stories list authors where possible.
    const nameById = new Map<string, string>();
    stories.forEach((s) => {
      if (s.authorName) nameById.set(s.userId, s.authorName);
    });
    return story.mentionIds.map((id) => nameById.get(id) ?? null).filter(Boolean) as string[];
  }, [story, stories]);

  if (!story) return null;

  const visibleStories = stories.filter((s) => !deleted.has(s.id));

  function go(delta: number) {
    const next = (index + delta + visibleStories.length) % visibleStories.length;
    setIndex(visibleStories.findIndex((s) => s.id === visibleStories[next].id));
  }

  async function handleDelete() {
    if (!story) return;
    await deleteStory(story.id);
    setDeleted((prev) => new Set(prev).add(story.id));
    const remaining = visibleStories.filter((s) => s.id !== story.id);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    const nextIndex = Math.min(index, remaining.length - 1);
    setIndex(remaining.findIndex((s) => s.id === remaining[nextIndex].id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="animate-modal-in w-full max-w-sm overflow-hidden rounded-[10px] border border-base bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[3/4] w-full bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.imageUrl} alt={`${story.authorName ?? "Someone"}'s story`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
          >
            ✕
          </button>
          <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
            {story.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.authorAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : null}
            {story.authorName ?? "Someone"}
          </span>

          {visibleStories.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                aria-label="Previous story"
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                aria-label="Next story"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
              >
                ›
              </button>
            </>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-warn transition hover:bg-black/70"
            >
              Delete story
            </button>
          )}
        </div>

        <div className="p-5">
          {story.caption && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Caption</p>
              <p className="mt-2 text-sm text-navy">{story.caption}</p>
            </>
          )}
          {mentionNames.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              With {mentionNames.map((name) => name.split(" ")[0]).join(", ")}
            </p>
          )}

          {isOwner ? (
            <div className="mt-4 border-t border-base pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Viewed by {storyViewers.length}
              </p>
              {storyViewers.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No views yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {storyViewers.map((v) => (
                    <span key={v.id} className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-navy">
                      {v.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted">
              Posted {new Date(story.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
