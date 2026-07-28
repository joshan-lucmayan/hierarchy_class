"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LIBRARY_BOOKS, TEACHER_PROFILE } from "@/data/mockStudents";
import { LIBRARY_BORROW_LOG_SEED, LIBRARY_BORROW_REQUESTS_SEED } from "@/data/library";
import { LibraryBook, LibraryBorrowLogEntry, LibraryBorrowRequest } from "@/types/student";
import { useChatStore } from "@/lib/chatStore";

const STORAGE_BOOKS = "hc-library-books";
const STORAGE_REQUESTS = "hc-library-requests";
const STORAGE_LOG = "hc-library-log";

// TEMP: messages from the library go out under whichever teacher is flagged
// isLibrarian. Once accounts are real, this resolves to the actual signed-in
// librarian instead of the shared mock profile.
const LIBRARIAN_ID = TEACHER_PROFILE.id;
const LIBRARIAN_NAME = TEACHER_PROFILE.name;
const LIBRARIAN_INITIALS = TEACHER_PROFILE.initials;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Borrower = { id: string; name: string; gradeSection: string };

interface LibraryContextValue {
  books: LibraryBook[];
  requests: LibraryBorrowRequest[];
  log: LibraryBorrowLogEntry[];
  requestBorrow: (book: LibraryBook, borrower: Borrower) => void;
  approveRequest: (requestId: string, pickupWindow: string) => void;
  declineRequest: (requestId: string) => void;
  returnBook: (bookId: string) => void;
  historyForBook: (bookTitle: string) => LibraryBorrowLogEntry[];
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { sendSystemMessage } = useChatStore();
  const [books, setBooks] = useState<LibraryBook[]>(LIBRARY_BOOKS);
  const [requests, setRequests] = useState<LibraryBorrowRequest[]>(LIBRARY_BORROW_REQUESTS_SEED);
  const [log, setLog] = useState<LibraryBorrowLogEntry[]>(LIBRARY_BORROW_LOG_SEED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedBooks = window.localStorage.getItem(STORAGE_BOOKS);
      const savedRequests = window.localStorage.getItem(STORAGE_REQUESTS);
      const savedLog = window.localStorage.getItem(STORAGE_LOG);
      if (savedBooks) setBooks(JSON.parse(savedBooks));
      if (savedRequests) setRequests(JSON.parse(savedRequests));
      if (savedLog) setLog(JSON.parse(savedLog));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books));
  }, [books, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_REQUESTS, JSON.stringify(requests));
  }, [requests, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_LOG, JSON.stringify(log));
  }, [log, hydrated]);

  function requestBorrow(book: LibraryBook, borrower: Borrower) {
    const request: LibraryBorrowRequest = {
      id: `req-${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      studentId: borrower.id,
      studentName: borrower.name,
      gradeSection: borrower.gradeSection,
      requestedAt: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };
    setRequests((prev) => [request, ...prev]);
    setBooks((prev) =>
      prev.map((b) =>
        b.id === book.id ? { ...b, status: "requested", borrowedBy: borrower.id, borrowedByName: borrower.name } : b
      )
    );
    sendSystemMessage(
      "student",
      LIBRARIAN_ID,
      LIBRARIAN_NAME,
      LIBRARIAN_INITIALS,
      `We received your request for "${book.title}". We'll message you the pickup time once it's approved.`
    );
  }

  function approveRequest(requestId: string, pickupWindow: string) {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setBooks((prev) =>
      prev.map((b) =>
        b.id === request.bookId
          ? { ...b, status: "borrowed", borrowedDate: todayISO(), dueDate: addDaysISO(14) }
          : b
      )
    );
    setLog((prev) => [
      {
        id: `log-${Date.now()}`,
        bookId: request.bookId,
        bookTitle: request.bookTitle,
        studentId: request.studentId,
        studentName: request.studentName,
        gradeSection: request.gradeSection,
        borrowedDate: todayISO(),
      },
      ...prev,
    ]);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    sendSystemMessage(
      "student",
      LIBRARIAN_ID,
      LIBRARIAN_NAME,
      LIBRARIAN_INITIALS,
      `Good news! "${request.bookTitle}" is ready for pickup: ${pickupWindow}.`
    );
  }

  function declineRequest(requestId: string) {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setBooks((prev) =>
      prev.map((b) =>
        b.id === request.bookId ? { ...b, status: "available", borrowedBy: undefined, borrowedByName: undefined } : b
      )
    );
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    sendSystemMessage(
      "student",
      LIBRARIAN_ID,
      LIBRARIAN_NAME,
      LIBRARIAN_INITIALS,
      `Sorry, we couldn't approve your request for "${request.bookTitle}" right now. Please check back later.`
    );
  }

  function returnBook(bookId: string) {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === bookId
          ? { ...b, status: "available", borrowedBy: undefined, borrowedByName: undefined, borrowedDate: undefined, dueDate: undefined }
          : b
      )
    );
    setLog((prev) => {
      const idx = prev.findIndex((entry) => entry.bookId === bookId && !entry.returnedDate);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], returnedDate: todayISO() };
      return next;
    });
  }

  function historyForBook(bookTitle: string) {
    const normalized = bookTitle.trim().toLowerCase();
    if (!normalized) return [];
    return log.filter((entry) => entry.bookTitle.toLowerCase().includes(normalized));
  }

  const value = useMemo(
    () => ({ books, requests, log, requestBorrow, approveRequest, declineRequest, returnBook, historyForBook }),
    [books, requests, log]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryStore() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryStore must be used within a LibraryProvider");
  return ctx;
}
