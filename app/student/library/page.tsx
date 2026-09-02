"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPost, IconBack, IconChevronRight, IconCheck } from "@/components/ui/icons";
import { BookCover } from "@/components/library/BookCover";
import { BookDetailModal, bookStatusChip, bookStatusLine } from "@/components/library/BookDetailModal";
import { BorrowReceiptModal } from "@/components/library/BorrowReceiptModal";
import { useMyProfile } from "@/lib/useMyProfile";
import { LibraryBook, LibraryStatus } from "@/types/student";
import { useLibraryStore } from "@/lib/libraryStore";
import { overdueLine } from "@/lib/libraryUtils";

// Librarians sometimes type multiple genres separated by commas into the
// single "genre" field (e.g. "Dystopian, political fiction, sci-fi").
// Split those apart everywhere we filter/display genres.
function splitGenres(genre: string): string[] {
  return genre
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageContent />
    </Suspense>
  );
}

function LibraryPageContent() {
  const { books, log, requestBorrow, receiptForLog, loading, error } = useLibraryStore();
  const { profile } = useMyProfile();
  const searchParams = useSearchParams();
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | LibraryStatus>("all");
  const [sortBy, setSortBy] = useState<"title-asc" | "title-desc" | "author-asc" | "author-desc">("title-asc");
  const [page, setPage] = useState(1);
  const [requestDays, setRequestDays] = useState(7);
  const PAGE_SIZE = 25;

  // Deep link from a library notification (e.g. "Book ready for pickup") -
  // ?book=<id> auto-opens that book's detail modal.
  useEffect(() => {
    const bookId = searchParams.get("book");
    if (!bookId) return;
    const target = books.find((b) => b.id === bookId);
    if (target) setSelectedBook(target);
  }, [books, searchParams]);

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(books.flatMap((b) => splitGenres(b.genre)))).sort()],
    [books]
  );

  // Catalog discovery pipeline: raw books -> search (title/author/genre/isbn)
  // -> status filter -> genre filter -> sort -> paginate. Memoized so a large
  // catalog stays cheap; the store itself is untouched.
  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase();
    const searched = books.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.genre.toLowerCase().includes(q) ||
        (book.isbn ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || book.status === statusFilter;
      const matchesGenre = genreFilter === "All" || splitGenres(book.genre).includes(genreFilter);
      return matchesQuery && matchesStatus && matchesGenre;
    });
    return [...searched].sort((a, b) => {
      if (sortBy === "title-desc") return b.title.localeCompare(a.title);
      if (sortBy === "author-asc") return a.author.localeCompare(b.author);
      if (sortBy === "author-desc") return b.author.localeCompare(a.author);
      return a.title.localeCompare(b.title);
    });
  }, [books, query, genreFilter, statusFilter, sortBy]);

  const statusCounts = useMemo(
    () => ({
      all: books.length,
      available: books.filter((b) => b.status === "available").length,
      borrowed: books.filter((b) => b.status === "borrowed").length,
      requested: books.filter((b) => b.status === "requested").length,
    }),
    [books]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageBooks = useMemo(
    () => filteredBooks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredBooks, safePage]
  );
  const pageStart = (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredBooks.length);

  const myActiveBooks = useMemo(
    () => books.filter((book) => book.borrowedBy === profile?.id && book.status !== "available"),
    [books, profile]
  );
  const myHistory = useMemo(
    () => log.filter((entry) => entry.studentId === profile?.id),
    [log, profile]
  );

  const hasActiveFilters = !!query.trim() || statusFilter !== "all" || genreFilter !== "All";

  function clearAll() {
    setQuery("");
    setStatusFilter("all");
    setGenreFilter("All");
    setPage(1);
  }

  function handleRequestBorrow(book: LibraryBook, days: number) {
    if (!profile) return;
    requestBorrow(book, {
      id: profile.id,
      name: profile.full_name,
      gradeSection: [profile.educational_level, profile.level_label].filter(Boolean).join(" · "),
    }, days);
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Library</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Discover books · check availability · find your next read
          </h2>
        </div>
        <Stat
          label="Available"
          value={loading ? "-" : statusCounts.available}
          tone="gold"
          hint={`${books.length} in catalog`}
        />
      </div>

      {loading ? (
        /* Skeleton: mirror the catalog-row geometry. */
        <CornerFrame className="p-5">
          <div className="h-3 w-32 animate-pulse rounded-full bg-tile" />
          <div className="mt-4 h-10 animate-pulse rounded-[10px] bg-tile" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-3">
                <div className="h-14 w-10 shrink-0 rounded-lg bg-tile" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded-full bg-tile" />
                  <div className="h-2.5 w-24 rounded-full bg-tile" />
                </div>
                <div className="h-7 w-16 rounded-full bg-tile" />
              </div>
            ))}
          </div>
        </CornerFrame>
      ) : error ? (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            {/* ======================================================== */}
            {/* CATALOG - primary discovery surface                      */}
            {/* ======================================================== */}
            <CornerFrame className="min-w-0 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="section-label">Catalog</h3>
                <Chip variant="gold">
                  {books.length} book{books.length === 1 ? "" : "s"}
                </Chip>
              </div>
              <div className="relative mt-3">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by title, author, genre, or ISBN..."
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-16 text-sm text-navy outline-none focus:border-gold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                  {filteredBooks.length}
                </span>
              </div>

              {/* Discovery bar: status pills + genre + sort */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", "All"],
                    ["available", "Available"],
                    ["borrowed", "Borrowed"],
                    ["requested", "Requested"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      statusFilter === value
                        ? "border-gold-token bg-[var(--surface-strong)] text-navy"
                        : "border-base bg-surface text-muted hover:border-gold-soft"
                    }`}
                  >
                    {label} ({statusCounts[value]})
                  </button>
                ))}
                <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                  <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                    <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Genre</span>
                    <select
                      value={genreFilter}
                      onChange={(e) => {
                        setGenreFilter(e.target.value);
                        setPage(1);
                      }}
                      className="min-w-0 flex-1 rounded-[8px] border border-base bg-surface px-2.5 py-1.5 text-xs text-navy outline-none focus:border-gold sm:flex-initial"
                    >
                      {genres.map((genre) => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                    <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as typeof sortBy);
                        setPage(1);
                      }}
                      className="min-w-0 flex-1 rounded-[8px] border border-base bg-surface px-2.5 py-1.5 text-xs text-navy outline-none focus:border-gold sm:flex-initial"
                    >
                      <option value="title-asc">Title A-Z</option>
                      <option value="title-desc">Title Z-A</option>
                      <option value="author-asc">Author A-Z</option>
                      <option value="author-desc">Author Z-A</option>
                    </select>
                  </label>
                </div>
              </div>

              {books.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No books available"
                    desc="The school library hasn't added any books yet. Check back soon."
                  />
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No books found"
                    desc="No books match the current search or filters."
                  />
                  {hasActiveFilters && (
                    <div className="mt-3 text-center">
                      <Button variant="ghost" size="sm" onClick={clearAll}>
                        Clear search &amp; filters
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-faint">
                      Showing {pageStart}-{pageEnd} of {filteredBooks.length} book{filteredBooks.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<IconBack size={12} />}
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage <= 1}
                      >
                        Prev
                      </Button>
                      {totalPages <= 7 ? (
                        Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            aria-current={n === safePage ? "page" : undefined}
                            className={`h-8 w-8 rounded-[8px] text-xs font-semibold transition ${
                              n === safePage
                                ? "bg-gold-token text-on-accent"
                                : "border border-base bg-surface text-muted hover:border-gold-soft"
                            }`}
                          >
                            {n}
                          </button>
                        ))
                      ) : (
                        <span className="px-2 font-mono-ui text-[10px] uppercase tracking-[0.12em] text-faint">
                          {safePage} / {totalPages}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<IconChevronRight size={12} />}
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 max-h-[55vh] max-h-[55dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[480px]" style={{ maxHeight: "min(55vh, 55dvh, 480px)" }}>
                    {pageBooks.map((book) => {
                      const chip = bookStatusChip(book, book.borrowedBy === profile?.id, "student");
                      return (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          className="group flex w-full items-center gap-3 rounded-[10px] border border-base bg-surface p-3 text-left transition hover:border-gold-soft"
                        >
                          <BookCover book={book} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{book.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {book.author} · {book.genre}
                            </p>
                            <div className="mt-1.5">
                              <Chip variant={chip.variant}>{chip.label}</Chip>
                            </div>
                          </div>
                          <span className="shrink-0 text-muted transition group-hover:text-gold-token">
                            <IconChevronRight size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CornerFrame>

            {/* ======================================================== */}
            {/* MY REQUESTS & LOANS                                       */}
            {/* ======================================================== */}
            <CornerFrame className="min-w-0 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="section-label">My requests &amp; loans</h3>
                <Chip variant={myActiveBooks.length > 0 ? "warn" : "neutral"}>{myActiveBooks.length}</Chip>
              </div>
              {myActiveBooks.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="Nothing active"
                    desc="Request a book from the catalog and it will show up here."
                  />
                </div>
              ) : (
                <div className="mt-3 max-h-[55vh] max-h-[55dvh] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain pr-1 md:max-h-[480px]" style={{ maxHeight: "min(55vh, 55dvh, 480px)" }}>
                  {myActiveBooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setSelectedBook(book)}
                      className="group flex w-full items-center gap-3 py-3 text-left transition hover:bg-[var(--surface-strong)]"
                    >
                      <BookCover book={book} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{book.title}</p>
                        <p className="mt-1 text-xs text-muted">{bookStatusLine(book, true, "student")}</p>
                        {book.location && (
                          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-token">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {book.location}
                          </p>
                        )}
                        {book.status === "borrowed" && overdueLine(book.dueDate) && (
                          <p className="mt-1 text-xs font-semibold text-warn">{overdueLine(book.dueDate)}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-muted transition group-hover:text-gold-token">
                        <IconChevronRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CornerFrame>
          </section>

          {/* ========================================================== */}
          {/* BORROW HISTORY                                            */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Borrow history</h3>
              <Chip variant="neutral">{myHistory.length}</Chip>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Everything you&apos;ve borrowed and returned this semester.
            </p>
            {myHistory.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={<IconPost size={16} />}
                  title="No borrow history yet"
                  desc="Books you borrow and return will appear here."
                />
              </div>
            ) : (
              <div className="mt-3 max-h-[40vh] max-h-[40dvh] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain pr-1 md:max-h-[320px]" style={{ maxHeight: "min(40vh, 40dvh, 320px)" }}>
                {myHistory.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{record.bookTitle}</p>
                      <p className="mt-1 text-xs text-muted">
                        {record.returnedDate
                          ? `Returned ${record.returnedDate}${record.fineAmount && record.fineAmount > 0 ? ` · Fine ${record.fineAmount.toFixed(0)} pesos` : ""}`
                          : "Still out"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono-ui text-[10px] uppercase tracking-[0.1em] text-muted">
                        {record.borrowedDate}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReceiptId(record.id)}
                      >
                        Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>
        </>
      )}

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          isMine={selectedBook.borrowedBy === profile?.id}
          onClose={() => { setSelectedBook(null); setRequestDays(7); }}
          action={
            selectedBook.status === "available" ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Borrow for</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={requestDays}
                    onChange={(e) => setRequestDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                    className="w-16 rounded-[8px] border border-base bg-surface px-2.5 py-1.5 text-center text-xs text-navy outline-none focus:border-gold"
                  />
                  <span className="text-xs text-muted">days</span>
                </label>
                <Button
                  variant="gold"
                  className="w-full"
                  icon={<IconCheck size={13} />}
                  onClick={() => {
                    handleRequestBorrow(selectedBook, requestDays);
                    setSelectedBook(null);
                    setRequestDays(7);
                  }}
                >
                  Request to borrow
                </Button>
              </div>
            ) : (
              <Button variant="ghost" disabled className="w-full">
                {selectedBook.borrowedBy === profile?.id ? "Request already sent" : "Not available right now"}
              </Button>
            )
          }
        />
      )}

      {selectedReceiptId && (
        <BorrowReceiptModal
          receipt={receiptForLog(log.find((e) => e.id === selectedReceiptId)!)}
          onClose={() => setSelectedReceiptId(null)}
        />
      )}
    </div>
  );
}
