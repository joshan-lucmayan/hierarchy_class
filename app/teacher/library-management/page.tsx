"use client";

import { useMemo, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus, IconPencil, IconCheck, IconX, IconBack, IconChevronRight, IconPost, IconTask, IconCalendar } from "@/components/ui/icons";
import { useLibraryStore } from "@/lib/libraryStore";
import { LibraryBorrowRequest, LibraryBook, LibraryStatus } from "@/types/student";
import { AddBookModal } from "@/components/library/AddBookModal";
import { EditBookModal } from "@/components/library/EditBookModal";
import { BookCover } from "@/components/library/BookCover";
import { BookDetailModal } from "@/components/library/BookDetailModal";

function ApproveRow({
  request,
  onApprove,
  onDecline,
}: {
  request: LibraryBorrowRequest;
  onApprove: (id: string, pickupWindow: string) => void;
  onDecline: (id: string) => void;
}) {
  const [pickupWindow, setPickupWindow] = useState("Today, 2:00 PM - 4:00 PM at the Library Desk");

  return (
    <div className="rounded-[10px] border border-base bg-surface p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{request.bookTitle}</p>
          <p className="mt-1 text-xs text-muted">
            {request.studentName} · {request.gradeSection} · requested {request.requestedAt}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={pickupWindow}
          onChange={(e) => setPickupWindow(e.target.value)}
          placeholder="Pickup window, e.g. Today 2-4 PM"
          className="flex-1 rounded-[10px] border border-base bg-surface px-4 py-2 text-sm text-navy outline-none focus:border-gold"
        />
        <div className="flex gap-2">
          <Button
            variant="gold"
            size="sm"
            icon={<IconCheck size={13} />}
            onClick={() => onApprove(request.id, pickupWindow)}
            disabled={!pickupWindow.trim()}
          >
            Approve
          </Button>
          <Button variant="outline" size="sm" icon={<IconX size={13} />} onClick={() => onDecline(request.id)}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryManagementPage() {
  const { books, requests, approveRequest, declineRequest, returnBook, historyForBook, loading, error } =
    useLibraryStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddBook, setShowAddBook] = useState(false);
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null);
  const [viewingBook, setViewingBook] = useState<LibraryBook | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LibraryStatus>("all");
  const [sortBy, setSortBy] = useState<"title-asc" | "title-desc" | "author-asc" | "author-desc">("title-asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const borrowedBooks = books.filter((book) => book.status === "borrowed");
  const searchResults = historyForBook(searchQuery);

  // Catalog discovery pipeline: raw books -> search (title/author/genre/isbn)
  // -> status filter -> sort -> paginate. Memoized so a large catalog stays
  // cheap; the store itself is untouched.
  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.toLowerCase();
    const searched = books.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.genre.toLowerCase().includes(q) ||
        (book.isbn ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || book.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
    return [...searched].sort((a, b) => {
      if (sortBy === "title-desc") return b.title.localeCompare(a.title);
      if (sortBy === "author-asc") return a.author.localeCompare(b.author);
      if (sortBy === "author-desc") return b.author.localeCompare(a.author);
      return a.title.localeCompare(b.title);
    });
  }, [books, catalogQuery, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalog.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageBooks = useMemo(
    () => filteredCatalog.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCatalog, safePage]
  );
  const statusCounts = useMemo(
    () => ({
      all: books.length,
      available: books.filter((b) => b.status === "available").length,
      borrowed: books.filter((b) => b.status === "borrowed").length,
      requested: books.filter((b) => b.status === "requested").length,
    }),
    [books]
  );
  const pageStart = (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filteredCatalog.length);

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Librarian desk</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Library management · approve, track, return
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Stat
            label="Books out"
            value={loading ? "-" : borrowedBooks.length}
            tone="gold"
            hint="Currently borrowed"
          />
          <Button variant="gold" size="md" icon={<IconPlus size={13} />} onClick={() => setShowAddBook(true)}>
            Add book
          </Button>
        </div>
      </div>

      {showAddBook && <AddBookModal onClose={() => setShowAddBook(false)} />}
      {editingBook && <EditBookModal book={editingBook} onClose={() => setEditingBook(null)} />}
      {viewingBook && <BookDetailModal book={viewingBook} context="teacher" onClose={() => setViewingBook(null)} />}

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
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
          Couldn&apos;t load the library. Please refresh and try again.
        </p>
      ) : (
        <>
          {/* ========================================================== */}
          {/* FULL CATALOG                                              */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Full catalog</h3>
              <Chip variant="gold">
                {books.length} book{books.length === 1 ? "" : "s"}
              </Chip>
            </div>
            <div className="relative mt-3">
              <input
                value={catalogQuery}
                onChange={(e) => {
                  setCatalogQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by title, author, genre, or ISBN..."
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-16 text-sm text-navy outline-none focus:border-gold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                {filteredCatalog.length}
              </span>
            </div>

            {/* Discovery bar: status filter pills + sort */}
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
              <label className="ml-auto flex items-center gap-2">
                <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as typeof sortBy);
                    setPage(1);
                  }}
                  className="rounded-[8px] border border-base bg-surface px-2.5 py-1.5 text-xs text-navy outline-none focus:border-gold"
                >
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="author-asc">Author A-Z</option>
                  <option value="author-desc">Author Z-A</option>
                </select>
              </label>
            </div>

            {books.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={<IconPost size={16} />}
                  title="No books added yet"
                  desc='Use "Add book" to get your catalog started.'
                />
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={<IconPost size={16} />}
                  title="No books found"
                  desc="No books match the current search or filters."
                />
                {(catalogQuery || statusFilter !== "all") && (
                  <div className="mt-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCatalogQuery("");
                        setStatusFilter("all");
                        setPage(1);
                      }}
                    >
                      Clear search &amp; filters
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-faint">
                    Showing {pageStart}-{pageEnd} of {filteredCatalog.length} book{filteredCatalog.length === 1 ? "" : "s"}
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

                <div className="mt-2 max-h-[440px] space-y-2 overflow-y-auto pr-1">
                  {pageBooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      title="View book details"
                      onClick={() => setViewingBook(book)}
                      className="flex w-full items-center gap-3 rounded-[10px] border border-base bg-surface p-3 text-left transition hover:border-gold-soft"
                    >
                      <BookCover book={book} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{book.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{book.author} · {book.genre}</p>
                        <div className="mt-1.5">
                          <Chip
                            variant={
                              book.status === "available" || book.status === "requested" ? "success" : "neutral"
                            }
                          >
                            {book.status === "available" ? "Available" : book.status === "requested" ? "Requested" : "Borrowed"}
                          </Chip>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<IconPencil size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBook(book);
                        }}
                        className="shrink-0"
                      >
                        Edit
                      </Button>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CornerFrame>

          {/* ========================================================== */}
          {/* PENDING PICKUP REQUESTS                                   */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Pending pickup requests</h3>
              <Chip variant={requests.length > 0 ? "warn" : "neutral"}>
                {requests.length} pending
              </Chip>
            </div>
            {requests.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={<IconTask size={16} />}
                  title="No pending requests"
                  desc="Student pickup requests appear here for approval."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {requests.map((request) => (
                  <ApproveRow key={request.id} request={request} onApprove={approveRequest} onDecline={declineRequest} />
                ))}
              </div>
            )}
          </CornerFrame>

          {/* ========================================================== */}
          {/* CURRENTLY BORROWED                                        */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Currently borrowed</h3>
              <Chip variant="neutral">
                {borrowedBooks.length} out
              </Chip>
            </div>
            {borrowedBooks.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={<IconCalendar size={16} />}
                  title="Nothing checked out"
                  desc="Books you mark as borrowed will show up here with their due dates."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {borrowedBooks.map((book) => (
                  <div key={book.id} className="flex flex-col gap-2 rounded-[10px] border border-base bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{book.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {book.borrowedByName} · borrowed {book.borrowedDate} · due {book.dueDate}
                      </p>
                    </div>
                    <Button
                      variant="gold"
                      size="sm"
                      icon={<IconCheck size={12} />}
                      onClick={() => returnBook(book.id)}
                      className="shrink-0"
                    >
                      Mark returned
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>

          {/* ========================================================== */}
          {/* BOOK HISTORY LOOKUP                                       */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Book history lookup</h3>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Search a book title to see everyone who has borrowed it - useful for tracking down a missing copy.
            </p>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search a book title..."
              className="mt-3 w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
            />
            {searchQuery.trim() && (
              <div className="mt-4 space-y-2">
                {searchResults.length === 0 ? (
                  <div className="py-4">
                    <EmptyState
                      icon={<IconPost size={16} />}
                      title="No history found"
                      desc="No borrow history found for that title."
                    />
                  </div>
                ) : (
                  searchResults.map((entry) => (
                    <div key={entry.id} className="rounded-[10px] border border-base bg-surface p-4">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <p className="font-semibold text-navy">{entry.studentName}</p>
                        <span className="text-muted">{entry.gradeSection}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 font-mono-ui text-[10px] uppercase tracking-[0.1em] text-muted">
                        <span>Borrowed {entry.borrowedDate}</span>
                        <span>{entry.returnedDate ? `Returned ${entry.returnedDate}` : "Still out"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CornerFrame>
        </>
      )}
    </div>
  );
}
