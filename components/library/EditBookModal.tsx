"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconTrash } from "@/components/ui/icons";
import { BookCover } from "@/components/library/BookCover";
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

  const inputCls =
    "w-full rounded-[10px] border border-base bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-gold";
  const fieldLabel = "font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint";

  return (
    <Modal onClose={onClose} eyebrow="Library" description="Update this book in the school catalog">
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <h3 className="section-label">Book information</h3>
        <div className="flex gap-4">
          <BookCover book={book} size="lg" />
          <div className="flex-1 space-y-2">
            <label htmlFor="edit-book-title" className={fieldLabel}>Title</label>
            <input
              id="edit-book-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              required
              className={inputCls}
            />
            <label htmlFor="edit-book-author" className={fieldLabel}>Author</label>
            <input
              id="edit-book-author"
              value={draft.author}
              onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
              placeholder="Author"
              required
              className={inputCls}
            />
          </div>
        </div>

        <label htmlFor="edit-book-genre" className={fieldLabel}>Genre</label>
        <input
          id="edit-book-genre"
          value={draft.genre}
          onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
          placeholder="Genre"
          className={inputCls}
        />
        <label htmlFor="edit-book-description" className={fieldLabel}>Description</label>
        <textarea
          id="edit-book-description"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Description (optional)"
          rows={3}
          className={inputCls}
        />
        <label htmlFor="edit-book-cover" className={fieldLabel}>Cover image URL</label>
        <input
          id="edit-book-cover"
          value={draft.coverUrl}
          onChange={(e) => setDraft((d) => ({ ...d, coverUrl: e.target.value }))}
          placeholder="Cover image URL (optional)"
          className={inputCls}
        />

        <div className="flex gap-2 pt-2">
          <Button
            type="submit"
            variant="gold"
            className="flex-1"
            icon={<IconCheck size={13} />}
            disabled={submitting || !draft.title.trim() || !draft.author.trim()}
            loading={submitting}
          >
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>

      <div className="mt-4 border-t border-base pt-4">
        {!confirmingDelete ? (
          <Button
            variant="danger"
            className="w-full"
            icon={<IconTrash size={13} />}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete this book
          </Button>
        ) : (
          <div className="space-y-3 rounded-[10px] border border-warn-soft bg-warn-soft p-4">
            <p className="text-xs leading-5 text-navy">
              Delete &quot;{book.title}&quot; permanently? This removes it from the library for
              everyone and can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDelete}
                disabled={submitting}
                loading={submitting}
              >
                {submitting ? "Deleting..." : "Yes, delete"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
