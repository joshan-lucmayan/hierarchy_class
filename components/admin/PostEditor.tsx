"use client";

import { useRef, useState } from "react";
import { useSchoolFeed, SchoolPost } from "@/lib/schoolFeedStore";

const AUDIENCES = [
  { value: "everyone", label: "Everyone in the school" },
  { value: "students", label: "Students only" },
  { value: "teachers", label: "Teachers only" },
];

const TAGS = ["Announcement", "Enrollment", "Advisory", "Event", "Campaign", "General"];

interface PostEditorProps {
  post: SchoolPost | null; // null = create
  onClose: () => void;
}

export function PostEditor({ post, onClose }: PostEditorProps) {
  const { createPost, updatePost } = useSchoolFeed();
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tag, setTag] = useState(post?.tag ?? "Announcement");
  const [audience, setAudience] = useState<"everyone" | "students" | "teachers">(post?.audience ?? "everyone");
  const [image, setImage] = useState<File | null>(null);
  const [notifyAudience, setNotifyAudience] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!body.trim()) {
      setFormError("Write something to publish.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const base = { title, body, tag, audience, image: image ?? undefined, notifyAudience };
    const ok = post ? await updatePost(post.id, { ...base, image: image ?? undefined, notifyAudience }) : (await createPost({ ...base, image: image ?? null })) !== null;

    setSubmitting(false);
    if (ok) onClose();
    else setFormError("Couldn't save the post. Please try again.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {post ? "Edit post" : "New school post"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="space-y-2 text-sm font-semibold text-muted">
            Title (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intramurals sign-up is open"
              className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-muted">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement or post..."
              rows={4}
              className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-muted">
              Tag
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
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
                className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted">Image (optional)</p>
            {post?.imageUrl && !image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.imageUrl} alt="Current post image" className="max-h-32 rounded-2xl border border-base object-contain" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-base bg-surface px-4 py-2.5 text-sm text-navy file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white outline-none focus:border-gold"
            />
          </div>

          <label className="flex items-center gap-2.5 rounded-2xl border border-base bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy">
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

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-full bg-gold py-3 text-sm font-semibold text-navy transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Publishing..." : post ? "Save changes" : "Publish"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-base px-6 py-3 text-sm font-semibold text-muted transition hover:border-gold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
