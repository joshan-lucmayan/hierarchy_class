"use client";

import { useState } from "react";
import type { StudentMusicRow } from "@/types/supabase";
import type { ResolvedMusic } from "@/lib/musicTypes";
import { useMyProfile } from "@/lib/useMyProfile";
import { useMusic, resolveMusicUrl, type MusicProfile } from "@/lib/useMusic";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconPlus, IconMusic, IconTrash } from "@/components/ui/icons";

const GRID_PAGE = 9;

function CoverFallback() {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[8px] border border-base bg-tile text-muted">
      <IconMusic size={22} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em]">Cover unavailable</span>
    </div>
  );
}

/**
 * Music tab - post music by link. The student pastes a URL and clicks Post;
 * the server resolves the metadata (title, artist, cover) and the post is
 * saved in one action - the student never types a title/artist/cover.
 * Owner-only posting/deleting; viewers see the cards and can click through
 * to the original link.
 */
export function Music({ studentId, viewer = false }: { studentId?: string; viewer?: boolean }) {
  const { profile } = useMyProfile();
  const targetId = studentId ?? profile?.id;
  const { music, loading, error, create, remove } = useMusic(targetId);
  const isOwner = !viewer;

  const [postOpen, setPostOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE);
  const visible = music.slice(0, visibleCount);

  return (
    <div>
      {isOwner && profile && (
        <div className="mb-4">
          <Button variant="gold" className="w-full" icon={<IconPlus size={15} />} onClick={() => setPostOpen(true)}>
            Post Music
          </Button>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading music...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-warn">{error}</p>
      ) : music.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {isOwner ? "No music yet — share a song by link." : "No music yet."}
        </p>
      ) : (
        <>
          {/* Compact grid: 3 columns desktop, 2 tablet, 1 mobile. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((m) => (
              <div key={m.id} className="relative rounded-[10px] border border-base bg-surface p-3">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    title="Remove music"
                    aria-label="Remove music"
                    className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-base bg-surface text-muted shadow-sm transition hover:border-warn-soft hover:text-warn"
                  >
                    <IconTrash size={12} />
                  </button>
                )}
                <a
                  href={m.music_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${m.title} by ${m.artist}`}
                  className="block transition"
                >
                  {m.album_cover_url ? (
                    <img
                      src={m.album_cover_url}
                      alt={`${m.title} cover`}
                      className="aspect-square w-full rounded-[8px] border border-base bg-tile object-cover"
                    />
                  ) : (
                    <CoverFallback />
                  )}
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-navy">{m.title}</p>
                  <p className="line-clamp-1 text-xs text-muted">{m.artist}</p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-faint">
                    {m.platform}
                  </p>
                </a>
              </div>
            ))}
          </div>
          {music.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + GRID_PAGE)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-base bg-surface py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-navy transition hover:border-gold-soft"
            >
              Load More
            </button>
          )}
        </>
      )}

      {postOpen && profile && (
        <PostMusicModal
          profile={{ id: profile.id, school_id: profile.school_id }}
          create={create}
          onClose={() => setPostOpen(false)}
        />
      )}
    </div>
  );
}

function PostMusicModal({
  profile,
  create,
  onClose,
}: {
  profile: MusicProfile;
  create: (meta: ResolvedMusic, profile: MusicProfile) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a valid music link.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      // Resolve metadata server-side, then save - one action, no separate preview step.
      const meta = await resolveMusicUrl(trimmed);
      const { error: err } = await create(meta, profile);
      if (err) {
        setError(err);
        setPosting(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music information could not be retrieved.");
      setPosting(false);
    }
  }

  return (
    <Modal eyebrow="Music" description="Post a song to your profile by link" onClose={onClose}>
      <h2 className="mt-3 text-xl font-bold text-navy">Post Music</h2>

      <form onSubmit={handlePost} className="mt-5 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Music Link</p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube, Spotify, Apple Music, SoundCloud, or Vimeo URL"
            className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
          />
        </div>
        {error && <p className="text-sm text-warn">{error}</p>}
        <Button type="submit" variant="gold" className="w-full" loading={posting} disabled={posting}>
          {posting ? "Posting..." : "Post"}
        </Button>
      </form>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={posting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
