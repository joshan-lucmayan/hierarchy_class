"use client";

import { useMemo, useRef, useState } from "react";
import { useStories, Story } from "@/lib/storiesStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { StoryViewerModal } from "@/components/feed/StoryViewerModal";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function StoriesRail() {
  const { profile } = useMyProfile();
  const { stories, loading, error, createStory, viewers } = useStories();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group by author, keeping each author's latest story.
  const grouped = useMemo(() => {
    const byAuthor = new Map<string, Story>();
    stories.forEach((s) => {
      const existing = byAuthor.get(s.userId);
      if (!existing || s.createdAt > existing.createdAt) byAuthor.set(s.userId, s);
    });
    const list = Array.from(byAuthor.values());
    return list.sort((a, b) => {
      const aMine = a.userId === profile?.id ? 0 : 1;
      const bMine = b.userId === profile?.id ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [stories, profile?.id]);

  const myStory = grouped.find((s) => s.userId === profile?.id) ?? null;
  // View count intentionally not shown on Home (per design); viewer modal still tracks viewers internally.

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPickedFile(file);
    setCreateError(null);
    e.target.value = "";
  }

  async function handlePublish() {
    if (!pickedFile) return;
    setPublishing(true);
    setCreateError(null);
    const storyId = await createStory(pickedFile, captionDraft || undefined);
    setPublishing(false);
    if (storyId) {
      setPickedFile(null);
      setCaptionDraft("");
      const idx = grouped.findIndex((s) => s.id === storyId);
      if (idx >= 0) setOpenIndex(idx);
    } else {
      setCreateError(error ?? "Couldn't publish your story. Please try again.");
    }
  }

  if (loading) return <div className="h-16" />;

  return (
    <>
      {grouped.length === 0 ? (
        <div className="flex items-center gap-2 sm:gap-3.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add story"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint transition active:scale-95 sm:h-[52px] sm:w-[52px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sm:w-[16px] sm:h-[16px]">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-[13px] text-muted">Add story</p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-faint">No stories yet - share your day.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1.5 sm:gap-4">
          {/* Your stories — single circle, first position. Small accent + badge on bottom-right. */}
          <div className="flex shrink-0 flex-col items-center gap-1 sm:gap-1.5">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <button
                type="button"
                onClick={() => {
                  if (myStory) {
                    const idx = grouped.findIndex((s) => s.id === myStory.id);
                    if (idx >= 0) setOpenIndex(idx);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                aria-label={myStory ? "View your story" : "Add story"}
                className={`flex h-full w-full items-center justify-center rounded-full p-[4px] transition active:scale-95 sm:p-[2px] ${
                  myStory ? "bg-[var(--surface-strong)]" : "border-2 border-dashed border-gold"
                }`}
              >
                <span
                  className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 ${
                    myStory ? "border-gold bg-navy" : "border-surface bg-navy text-base font-bold sm:text-lg text-gold"
                  }`}
                >
                  {myStory ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={myStory.imageUrl} alt="My story" className="h-full w-full object-cover" />
                  ) : (
                    "+"
                  )}
                </span>
              </button>
              {/* Small accent + badge — bottom-right of the story ring.
                  Positioned absolute bottom-0 right-0 relative to the exact circle wrapper.
                  No aria-label: the global button[aria-label] rule in globals.css
                  forces min-width/min-height: 44px on mobile, which would balloon
                  this small badge. The parent button already carries the accessible name. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-surface bg-gold text-on-accent shadow-sm transition active:scale-95 sm:h-5 sm:w-5"
              >
                <svg aria-hidden="true" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="sm:w-2.5 sm:h-2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <span className="max-w-[64px] truncate text-center text-[10px] sm:text-[11px] font-medium text-muted sm:max-w-[80px]">
              {myStory ? "Your stories" : "Add story"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {grouped
            .filter((s) => s.userId !== profile?.id)
            .map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setOpenIndex(grouped.findIndex((s) => s.id === story.id))}
                className="flex shrink-0 flex-col items-center gap-1 transition active:scale-95 sm:gap-1.5"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-strong)] p-[4px] sm:h-16 sm:w-16 sm:p-[2px]">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-navy">
                    <UserAvatar name={story.authorName} src={story.authorAvatar} size="xl" className="!border-0" />
                  </span>
                </span>
                <span className="max-w-[64px] truncate text-center text-[10px] sm:text-[11px] font-medium text-muted sm:max-w-[80px]">
                  {(story.authorName ?? "Someone").split(" ")[0]}
                </span>
              </button>
            ))}
        </div>
      )}

      {pickedFile && (
        <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-gold bg-[var(--surface-strong)] p-2.5 sm:mt-3 sm:flex-row sm:items-center sm:p-3">
          <input
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            placeholder="Add a caption for your story (optional)"
            maxLength={120}
            className="flex-1 rounded-full border border-base bg-surface px-3 py-1.5 text-xs text-navy outline-none focus:border-gold sm:px-4 sm:py-2 sm:text-sm min-w-0"
          />
          <div className="flex gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50 sm:px-4 sm:py-2"
            >
              {publishing ? "Publishing..." : "Publish story"}
            </button>
            <button
              type="button"
              onClick={() => setPickedFile(null)}
              className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-gold sm:px-4 sm:py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {createError && <p className="text-xs text-warn">{createError}</p>}

      {openIndex !== null && (
        <StoryViewerModal
          stories={grouped}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
