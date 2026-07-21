"use client";

import { useMemo, useState } from "react";
import { LIBRARY_BOOKS, BORROW_HISTORY } from "@/data/mockStudents";
import { LibraryBook, BorrowRecord } from "@/types/student";
import { CornerFrame } from "@/components/ui/CornerFrame";

export default function LibraryPage() {
  const [books, setBooks] = useState<LibraryBook[]>(LIBRARY_BOOKS);
  const [history] = useState<BorrowRecord[]>(BORROW_HISTORY);

  const borrowedBooks = useMemo(() => books.filter((book) => book.status === "borrowed"), [books]);
  const availableBooks = useMemo(() => books.filter((book) => book.status === "available"), [books]);

  function toggleBorrow(bookId: string) {
    setBooks((prev) =>
      prev.map((book) => {
        if (book.id !== bookId) return book;
        if (book.status === "available") {
          return { ...book, status: "borrowed", borrowedDate: "2026-07-16", dueDate: "2026-07-30" };
        }
        return { ...book, status: "available", borrowedDate: undefined, dueDate: undefined };
      })
    );
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
            Borrow a book for your next research task or return it before the due date.
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
          <div className="space-y-3">
            {availableBooks.map((book) => (
              <div key={book.id} className="rounded-3xl border border-base p-4 transition hover:border-gold">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">{book.title}</p>
                    <p className="mt-1 text-xs text-muted">{book.author} · {book.genre}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBorrow(book.id)}
                    className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                  >
                    Borrow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Currently borrowed</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {borrowedBooks.length} loans
            </span>
          </div>
          <div className="space-y-3">
            {borrowedBooks.map((book) => (
              <div key={book.id} className="rounded-3xl border border-base p-4 transition hover:border-gold">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">{book.title}</p>
                    <p className="mt-1 text-xs text-muted">Due {book.dueDate}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBorrow(book.id)}
                    className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                  >
                    Return
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CornerFrame>
      </section>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Borrow history</h2>
        <div className="mt-4 space-y-3">
          {history.map((record) => (
            <div key={record.id} className="rounded-3xl border border-base p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <p className="font-semibold text-navy">{record.title}</p>
                <span className="text-muted">{record.date}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                <span>{record.action}</span>
                {record.dueDate ? <span>Due {record.dueDate}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </CornerFrame>
    </div>
  );
}
