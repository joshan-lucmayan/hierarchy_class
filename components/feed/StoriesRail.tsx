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
  const myStoryViews = myStory ? viewers[myStory.id]?.length ?? 0 : 0;

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
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add story"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint transition active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[13px] text-muted">Add story</p>
            <p className="mt-0.5 text-[11px] text-faint">No stories yet - share your day.</p>
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
        <div className="flex gap-4 overflow-x-auto pb-2">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gold p-[2px] transition active:scale-95"
            >
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-navy text-lg font-bold text-gold">
                {myStory ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={myStory.imageUrl} alt="My story" className="h-full w-full object-cover" />
                ) : (
                  "+"
                )}
              </span>
            </button>
            <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">
              {myStory ? (myStoryViews > 0 ? `${myStoryViews} views` : "My Day") : "Add story"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {grouped.map((story) => {
            const isMine = story.userId === profile?.id;
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => setOpenIndex(grouped.findIndex((s) => s.id === story.id))}
                className="flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] p-[2px]">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-navy">
                    <UserAvatar name={story.authorName} src={story.authorAvatar} size="xl" className="!border-0" />
                  </span>
                </span>
                <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">
                  {isMine ? "My Day" : (story.authorName ?? "Someone").split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {pickedFile && (
        <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-gold bg-[var(--surface-strong)] p-3 sm:flex-row sm:items-center">
          <input
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            placeholder="Add a caption for your story (optional)"
            maxLength={120}
            className="flex-1 rounded-full border border-base bg-surface px-4 py-2 text-sm text-navy outline-none focus:border-gold"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish story"}
            </button>
            <button
              type="button"
              onClick={() => setPickedFile(null)}
              className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-gold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {createError && <p className="text-xs text-red-500">{createError}</p>}

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
