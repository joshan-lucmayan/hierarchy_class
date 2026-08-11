"use client";

import { useMemo, useState } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { LibraryBook } from "@/types/student";
import { useLibraryStore } from "@/lib/libraryStore";

// Librarians sometimes type multiple genres separated by commas into the
// single "genre" field (e.g. "Dystopian, political fiction, sci-fi").
// Split those apart everywhere we filter/display genres.
function splitGenres(genre: string): string[] {
  return genre
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function BookCover({ book, size = "sm" }: { book: LibraryBook; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const dims = size === "lg" ? "h-32 w-24" : "h-14 w-10";

  if (!book.coverUrl || failed) {
    return (
      <div className={`flex ${dims} shrink-0 items-center justify-center rounded-lg border border-base bg-[var(--surface-strong)]`}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">No cover</span>
      </div>
    );
  }

  return (
    <img
      src={book.coverUrl}
      alt=""
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 rounded-lg border border-base object-cover`}
    />
  );
}

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
        className="w-full max-w-md rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <div className="flex flex-wrap gap-1">
              {splitGenres(book.genre).map((g) => (
                <span key={g} className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  {g}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>
        <div className="mt-3 flex gap-4">
          <BookCover book={book} size="lg" />
          <div>
            <h2 className="text-2xl font-bold text-navy">{book.title}</h2>
            <p className="mt-1 text-sm text-muted">by {book.author}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{book.description}</p>

        {label && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
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
  const { profile } = useMyProfile();
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(books.flatMap((b) => splitGenres(b.genre)))).sort()],
    [books]
  );

  const availableBooks = useMemo(() => {
    const normalized = query.toLowerCase();
    return books.filter((book) => {
      if (book.status !== "available") return false;
      const matchesQuery =
        !normalized ||
        book.title.toLowerCase().includes(normalized) ||
        book.author.toLowerCase().includes(normalized);
      const matchesGenre = genreFilter === "All" || splitGenres(book.genre).includes(genreFilter);
      return matchesQuery && matchesGenre;
    });
  }, [books, query, genreFilter]);

  const myActiveBooks = useMemo(
    () => books.filter((book) => book.borrowedBy === profile?.id && book.status !== "available"),
    [books, profile]
  );
  const myHistory = useMemo(
    () => log.filter((entry) => entry.studentId === profile?.id),
    [log, profile]
  );

  function handleRequestBorrow(book: LibraryBook) {
    if (!profile) return;
    requestBorrow(book, {
      id: profile.id,
      name: profile.full_name,
      gradeSection: [profile.educational_level, profile.level_label].filter(Boolean).join(" · "),
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr] xl:divide-x xl:divide-[var(--border)]">
        <div className="space-y-4 xl:pr-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Available books</h2>
            <span className="text-xs font-semibold text-muted">
              {availableBooks.length} of {books.length}
            </span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 border-b border-base bg-transparent px-1 py-2 text-sm text-navy outline-none placeholder:text-muted focus:border-gold"
            />
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="border-b border-base bg-transparent px-1 py-2 text-sm text-navy outline-none focus:border-gold"
            >
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>
          <div className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto pr-1">
            {availableBooks.length === 0 ? (
              <p className="py-4 text-sm text-muted">No books match your search.</p>
            ) : (
              availableBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="group flex w-full items-start justify-between gap-4 py-4 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <BookCover book={book} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{book.title}</p>
                      <p className="mt-1 text-xs text-muted">{book.author}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {splitGenres(book.genre).map((g) => (
                          <span key={g} className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted">{book.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted transition group-hover:text-gold">
                    View →
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 xl:pl-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">My requests &amp; loans</h2>
            <span className="text-xs font-semibold text-muted">{myActiveBooks.length}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {myActiveBooks.length === 0 ? (
              <p className="py-4 text-sm text-muted">No pending requests or borrowed books right now.</p>
            ) : (
              myActiveBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="group flex w-full items-start justify-between gap-4 py-4 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <div className="flex items-start gap-3">
                    <BookCover book={book} />
                    <div>
                      <p className="text-sm font-semibold text-navy">{book.title}</p>
                      <p className="mt-1 text-xs text-muted">{statusLabel(book, true)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted transition group-hover:text-gold">
                    View →
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-base pt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Borrow history</h2>
        <p className="text-xs text-muted">Everything you&apos;ve borrowed and returned this semester.</p>
        <div className="max-h-[320px] divide-y divide-[var(--border)] overflow-y-auto pr-1">
          {myHistory.length === 0 ? (
            <p className="py-4 text-sm text-muted">No borrow history yet.</p>
          ) : (
            myHistory.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                <div>
                  <p className="font-semibold text-navy">{record.bookTitle}</p>
                  <p className="mt-1 text-xs text-muted">
                    {record.returnedDate ? `Returned ${record.returnedDate}` : "Still out"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">{record.borrowedDate}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedBook && (
        <BookModal
          book={selectedBook}
          isMine={selectedBook.borrowedBy === profile?.id}
          onClose={() => setSelectedBook(null)}
          onRequestBorrow={handleRequestBorrow}
        />
      )}
    </div>
  );
}
