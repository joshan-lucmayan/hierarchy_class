"use client";

import { useMemo, useState } from "react";
import { CURRENT_STUDENT } from "@/data/mockStudents";
import { LibraryBook } from "@/types/student";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useLibraryStore } from "@/lib/libraryStore";

function statusLabel(book: LibraryBook, isMine: boolean) {
  if (book.status === "available") return null;
  if (book.status === "requested") return isMine ? "Pending librarian approval" : "Requested by another student";
  return isMine ? `Due ${book.dueDate}` : "Currently borrowed";
}

function BookModal({
  book,
  isMine,
  onClose,
  onRequestBorrow,
}: {
  book: LibraryBook;
  isMine: boolean;
  onClose: () => void;
  onRequestBorrow: (book: LibraryBook) => void;
}) {
  const label = statusLabel(book, isMine);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border-2 border-gold bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{book.genre}</p>
          <button type="button" onClick={onClose} className="text-muted">✕</button>
        </div>
        <h2 className="mt-2 text-2xl font-bold text-navy">{book.title}</h2>
        <p className="mt-1 text-sm text-muted">by {book.author}</p>
        <p className="mt-4 text-sm leading-6 text-muted">{book.description}</p>

        {label && (
          <p className="mt-4 rounded-2xl border border-base bg-[var(--surface-strong)] p-3 text-xs text-muted">
            {label}
          </p>
        )}

        {book.status === "available" ? (
          <button
            type="button"
            onClick={() => {
              onRequestBorrow(book);
              onClose();
            }}
            className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Request to borrow
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-full bg-[var(--surface-strong)] py-2.5 text-sm font-semibold text-muted"
          >
            {isMine ? "Request already sent" : "Not available right now"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { books, log, requestBorrow } = useLibraryStore();
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  const availableBooks = useMemo(() => books.filter((book) => book.status === "available"), [books]);
  const myActiveBooks = useMemo(
    () => books.filter((book) => book.borrowedBy === CURRENT_STUDENT.id && book.status !== "available"),
    [books]
  );
  const myHistory = useMemo(
    () => log.filter((entry) => entry.studentId === CURRENT_STUDENT.id),
    [log]
  );

  function handleRequestBorrow(book: LibraryBook) {
    requestBorrow(book, {
      id: CURRENT_STUDENT.id,
      name: CURRENT_STUDENT.name,
      gradeSection: `Grade ${CURRENT_STUDENT.gradeLevel} · ${CURRENT_STUDENT.section}`,
    });
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Library</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">System Management</h1>
          </div>
          <p className="max-w-xl text-sm text-muted">
            Request a book to borrow — the librarian will confirm a pickup time by message.
          </p>
        </div>
      </CornerFrame>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Available books</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {availableBooks.length} available
            </span>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {availableBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => setSelectedBook(book)}
                className="block w-full rounded-3xl border border-base p-4 text-left transition hover:border-gold hover:bg-[var(--surface-strong)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{book.title}</p>
                    <p className="mt-1 text-xs text-muted">{book.author} · {book.genre}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{book.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy">
                    View
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">My requests &amp; loans</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {myActiveBooks.length}
            </span>
          </div>
          <div className="space-y-3">
            {myActiveBooks.length === 0 ? (
              <p className="text-sm text-muted">No pending requests or borrowed books right now.</p>
            ) : (
              myActiveBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="block w-full rounded-3xl border border-base p-4 text-left transition hover:border-gold hover:bg-[var(--surface-strong)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-navy">{book.title}</p>
                      <p className="mt-1 text-xs text-muted">{statusLabel(book, true)}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy">
                      View
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </CornerFrame>
      </section>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Borrow history</h2>
        <p className="mt-1 text-xs text-muted">Everything you&apos;ve borrowed and returned this semester.</p>
        <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {myHistory.length === 0 ? (
            <p className="text-sm text-muted">No borrow history yet.</p>
          ) : (
            myHistory.map((record) => (
              <div key={record.id} className="rounded-3xl border border-base p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-semibold text-navy">{record.bookTitle}</p>
                  <span className="text-muted">{record.borrowedDate}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                  <span>{record.returnedDate ? `Returned ${record.returnedDate}` : "Still out"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CornerFrame>

      {selectedBook && (
        <BookModal
          book={selectedBook}
          isMine={selectedBook.borrowedBy === CURRENT_STUDENT.id}
          onClose={() => setSelectedBook(null)}
          onRequestBorrow={handleRequestBorrow}
        />
      )}
    </div>
  );
}
