"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useLibraryStore } from "@/lib/libraryStore";
import { LibraryBorrowRequest } from "@/types/student";

function ApproveRow({
  request,
  onApprove,
  onDecline,
}: {
  request: LibraryBorrowRequest;
  onApprove: (id: string, pickupWindow: string) => void;
  onDecline: (id: string) => void;
}) {
  const [pickupWindow, setPickupWindow] = useState("Today, 2:00 PM – 4:00 PM at the Library Desk");

  return (
    <div className="rounded-3xl border border-base p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">{request.bookTitle}</p>
          <p className="mt-1 text-xs text-muted">
            {request.studentName} · {request.gradeSection} · requested {request.requestedAt}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={pickupWindow}
          onChange={(e) => setPickupWindow(e.target.value)}
          placeholder="Pickup window, e.g. Today 2–4 PM"
          className="flex-1 rounded-2xl border border-base bg-surface px-4 py-2 text-sm text-navy outline-none focus:border-gold"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApprove(request.id, pickupWindow)}
            disabled={!pickupWindow.trim()}
            className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onDecline(request.id)}
            className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryManagementPage() {
  const { books, requests, approveRequest, declineRequest, returnBook, historyForBook } = useLibraryStore();
  const [searchQuery, setSearchQuery] = useState("");

  const borrowedBooks = books.filter((book) => book.status === "borrowed");
  const searchResults = historyForBook(searchQuery);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Library Management</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Librarian desk</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Approve pickup requests, track who currently has each book, and look up a book&apos;s full borrow history.
        </p>
      </CornerFrame>

      <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Pending pickup requests</h2>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
            {requests.length} pending
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">No pending requests right now.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <ApproveRow key={request.id} request={request} onApprove={approveRequest} onDecline={declineRequest} />
            ))}
          </div>
        )}
      </CornerFrame>

      <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Currently borrowed</h2>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
            {borrowedBooks.length} out
          </span>
        </div>
        {borrowedBooks.length === 0 ? (
          <p className="text-sm text-muted">No books are currently checked out.</p>
        ) : (
          <div className="space-y-3">
            {borrowedBooks.map((book) => (
              <div key={book.id} className="flex flex-col gap-2 rounded-3xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{book.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {book.borrowedByName} · borrowed {book.borrowedDate} · due {book.dueDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => returnBook(book.id)}
                  className="shrink-0 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                >
                  Mark returned
                </button>
              </div>
            ))}
          </div>
        )}
      </CornerFrame>

      <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Book history lookup</h2>
        <p className="text-xs text-muted">
          Search a book title to see everyone who has borrowed it — useful for tracking down a missing copy.
        </p>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by book title..."
          className="w-full rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy outline-none"
        />
        {searchQuery.trim() && (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="rounded-2xl border border-base p-4 text-sm text-muted">No borrow history found for that title.</p>
            ) : (
              searchResults.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-base p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <p className="font-semibold text-navy">{entry.studentName}</p>
                    <span className="text-muted">{entry.gradeSection}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    <span>Borrowed {entry.borrowedDate}</span>
                    <span>{entry.returnedDate ? `Returned ${entry.returnedDate}` : "Still out"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CornerFrame>
    </div>
  );
}
