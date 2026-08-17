"use client";

import { useRef, useState } from "react";
import { useSchoolFeed, SchoolPost } from "@/lib/schoolFeedStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const AUDIENCES = [
  { value: "everyone", label: "Everyone in the school" },
  { value: "students", label: "Students only" },
  { value: "teachers", label: "Teachers only" },
];

const TAGS = ["Announcement", "Enrollment", "Advisory", "Event", "Campaign", "General"];

interface PostEditorProps {
  kind: "post" | "announcement";
  post: SchoolPost | null; // null = create
  onClose: () => void;
}

export function PostEditor({ kind, post, onClose }: PostEditorProps) {
  const { createPost, updatePost } = useSchoolFeed();
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tag, setTag] = useState(post?.tag ?? "General");
  const [audience, setAudience] = useState<"everyone" | "students" | "teachers">(post?.audience ?? "everyone");
  const [image, setImage] = useState<File | null>(null);
  const [notifyAudience, setNotifyAudience] = useState(kind === "announcement");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnnouncement = kind === "announcement";

  async function handleSave() {
    if (!body.trim()) {
      setFormError("Write something to publish.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const base = { type: kind, title, body, tag, audience, image: image ?? undefined, notifyAudience };
    const ok = post
      ? await updatePost(post.id, base)
      : (await createPost({ ...base, image: image ?? null })) !== null;

    setSubmitting(false);
    if (ok) onClose();
    else setFormError("Couldn't save. Please try again.");
  }

  return (
    <Modal
      onClose={onClose}
      eyebrow={post ? `Edit ${isAnnouncement ? "announcement" : "post"}` : `New ${isAnnouncement ? "announcement" : "school post"}`}
      description={
        isAnnouncement
          ? "Text-only notice for an important school announcement."
          : "A social-style feed post. Text is the main content; image and title are optional."
      }
    >
        <div className="mt-5 space-y-4">
          <label className="space-y-2 text-sm font-semibold text-muted">
            Title (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAnnouncement ? "e.g. Enrollment for the new semester is open" : "e.g. School Sports Festival"}
              className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-muted">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isAnnouncement ? "Write the announcement..." : "Write your post..."}
              rows={4}
              className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-muted">
              Tag
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              >
                {TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-muted">
              Visible to
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as typeof audience)}
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </label>
          </div>

          {!isAnnouncement && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted">Image (optional)</p>
              {post?.imageUrl && !image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="Current post image" className="max-h-32 rounded-[10px] border border-base object-contain" />
              )}
              <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-base bg-[var(--surface-strong)] px-4 py-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover-bg-gold-token hover-text-on-accent"
                >
                  Choose image
                </button>
                <span className="min-w-0 truncate text-xs text-muted">
                  {image ? image.name : "No image selected"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {isAnnouncement && (
            <label className="flex items-center gap-2.5 rounded-[10px] border border-base bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy">
              <input
                type="checkbox"
                checked={notifyAudience}
                onChange={(e) => setNotifyAudience(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Send a notification to {audience === "everyone" ? "everyone in the school" : audience === "students" ? "students" : "teachers"}
              </span>
            </label>
          )}

          {formError && <p className="text-sm text-warn">{formError}</p>}

          <div className="flex gap-3">
            <Button
              variant="gold"
              size="lg"
              onClick={handleSave}
              disabled={submitting}
              loading={submitting}
              className="flex-1"
            >
              {submitting ? "Publishing..." : post ? "Save changes" : isAnnouncement ? "Publish announcement" : "Publish post"}
            </Button>
            <Button variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
    </Modal>
  );
}
