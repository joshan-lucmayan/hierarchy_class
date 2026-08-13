"use client";

import { useState } from "react";
import { useLibraryStore } from "@/lib/libraryStore";
import { LibraryBook } from "@/types/student";

export function EditBookModal({ book, onClose }: { book: LibraryBook; onClose: () => void }) {
  const { updateBook, deleteBook } = useLibraryStore();
  const [draft, setDraft] = useState({
    title: book.title,
    author: book.author,
    genre: book.genre,
    description: book.description ?? "",
    coverUrl: book.coverUrl ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.author.trim()) return;
    setSubmitting(true);
    await updateBook(book.id, {
      title: draft.title.trim(),
      author: draft.author.trim(),
      genre: draft.genre.trim() || "Uncategorized",
      description: draft.description.trim() || undefined,
      coverUrl: draft.coverUrl.trim() || undefined,
    });
    setSubmitting(false);
    onClose();
  }

  async function handleDelete() {
    setSubmitting(true);
    await deleteBook(book.id);
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-base bg-surface p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Edit book</p>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div className="flex gap-4">
            {draft.coverUrl && (
              <img src={draft.coverUrl} alt="" className="h-28 w-20 shrink-0 rounded-lg border border-base object-cover" />
            )}
            <div className="flex-1 space-y-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Title"
                required
                className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <input
                value={draft.author}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                placeholder="Author"
                required
                className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
            </div>
          </div>

          <input
            value={draft.genre}
            onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
            placeholder="Genre"
            className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={3}
            className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
          />
          <input
            value={draft.coverUrl}
            onChange={(e) => setDraft((d) => ({ ...d, coverUrl: e.target.value }))}
            placeholder="Cover image URL (optional)"
            className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
          />

          <button
            type="submit"
            disabled={submitting || !draft.title.trim() || !draft.author.trim()}
            className="w-full rounded-full bg-navy py-2.5 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </form>

        <div className="mt-4 border-t border-base pt-4">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-full rounded-full border border-base px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
            >
              Delete this book
            </button>
          ) : (
            <div className="space-y-2 rounded-[10px] border border-red-300 bg-red-500/5 p-4">
              <p className="text-xs text-navy">
                Delete &quot;{book.title}&quot; permanently? This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 rounded-full bg-red-500 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 rounded-full border border-base py-2 text-xs font-semibold text-muted transition hover:border-gold hover:text-gold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
