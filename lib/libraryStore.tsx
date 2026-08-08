"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { LibraryBook, LibraryBorrowLogEntry, LibraryBorrowRequest } from "@/types/student";
import { useChatStore } from "@/lib/chatStore";

// TEMP: library messages go out under whichever teacher is flagged
// is_librarian for this school. Falls back to no message if none is set.
// This shim goes away once chat is wired to Supabase (next conversion step).
function useLibrarian() {
  const [librarian, setLibrarian] = useState<{ id: string; name: string; initials: string } | null>(null);
  const { profile } = useMyProfile();

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, full_name, initials")
      .eq("school_id", profile.school_id)
      .eq("is_librarian", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setLibrarian({ id: data.id, name: data.full_name, initials: data.initials ?? data.full_name.slice(0, 2).toUpperCase() });
        }
      });
  }, [profile]);

  return librarian;
}

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
  loading: boolean;
  error: string | null;
  addBook: (book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; isbn?: string }) => Promise<void>;
  updateBook: (id: string, book: { title: string; author: string; genre: string; description?: string; coverUrl?: string }) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  requestBorrow: (book: LibraryBook, borrower: Borrower) => Promise<void>;
  approveRequest: (requestId: string, pickupWindow: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  returnBook: (bookId: string) => Promise<void>;
  historyForBook: (bookTitle: string) => LibraryBorrowLogEntry[];
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const { sendSystemMessage } = useChatStore();
  const librarian = useLibrarian();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [requests, setRequests] = useState<LibraryBorrowRequest[]>([]);
  const [log, setLog] = useState<LibraryBorrowLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [
        { data: booksData, error: booksErr },
        { data: requestsData, error: requestsErr },
        { data: logData, error: logErr },
      ] = (await Promise.all([
        supabase.from("library_books").select("*").order("title"),
        supabase
          .from("library_borrow_requests")
          .select("*, student:profiles!student_id(full_name, level_label, section)")
          .eq("status", "pending")
          .order("requested_at", { ascending: false }),
        supabase
          .from("library_borrow_log")
          .select("*, student:profiles!student_id(full_name, level_label, section)")
          .order("date", { ascending: true }),
      ])) as any[];

      if (cancelled) return;

      if (booksErr || requestsErr || logErr) {
        setError("Couldn't load library data. Please refresh and try again.");
        setLoading(false);
        return;
      }

      setBooks(
        ((booksData ?? []) as any[]).map((b: any) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          genre: b.genre,
          description: b.description ?? "",
          status: b.status,
          borrowedBy: b.borrowed_by ?? undefined,
          borrowedByName: b.borrowed_by_name ?? undefined,
          borrowedDate: b.borrowed_date ? b.borrowed_date.slice(0, 10) : undefined,
          dueDate: b.due_date ? b.due_date.slice(0, 10) : undefined,
          coverUrl: b.cover_url ?? undefined,
          isbn: b.isbn ?? undefined,
        }))
      );

      setRequests(
        ((requestsData ?? []) as any[]).map((r: any) => ({
          id: r.id,
          bookId: r.book_id,
          bookTitle: (booksData as any[]).find((b) => b.id === r.book_id)?.title ?? "Unknown book",
          studentId: r.student_id,
          studentName: r.student?.full_name ?? "Unknown student",
          gradeSection: [r.student?.level_label, r.student?.section].filter(Boolean).join(" · "),
          requestedAt: new Date(r.requested_at).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        }))
      );

      // library_borrow_log stores "borrowed" and "returned" as separate event
      // rows. Pair each "borrowed" row with the next "returned" row for the
      // same book+student to reconstruct a single loan entry for the UI.
      const rawLog = (logData ?? []) as any[];
      const pairedLog: LibraryBorrowLogEntry[] = [];
      const usedReturnIds = new Set<string>();

      rawLog
        .filter((l) => l.action === "borrowed")
        .forEach((borrowRow) => {
          const returnRow = rawLog.find(
            (r) =>
              r.action === "returned" &&
              r.book_id === borrowRow.book_id &&
              r.student_id === borrowRow.student_id &&
              new Date(r.date) >= new Date(borrowRow.date) &&
              !usedReturnIds.has(r.id)
          );
          if (returnRow) usedReturnIds.add(returnRow.id);

          pairedLog.push({
            id: borrowRow.id,
            bookId: borrowRow.book_id,
            bookTitle: (booksData as any[]).find((b) => b.id === borrowRow.book_id)?.title ?? "Unknown book",
            studentId: borrowRow.student_id,
            studentName: borrowRow.student?.full_name ?? "Unknown student",
            gradeSection: [borrowRow.student?.level_label, borrowRow.student?.section].filter(Boolean).join(" · "),
            borrowedDate: borrowRow.date ? borrowRow.date.slice(0, 10) : "",
            returnedDate: returnRow?.date ? returnRow.date.slice(0, 10) : undefined,
          });
        });

      setLog(pairedLog.reverse());

      setError(null);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const addBook = useCallback(
    async (book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; isbn?: string }) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("library_books") as any).insert({
        school_id: profile.school_id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        description: book.description ?? null,
        cover_url: book.coverUrl ?? null,
        isbn: book.isbn ?? null,
        status: "available",
      });
      refetch();
    },
    [profile, refetch]
  );

  const updateBook = useCallback(
    async (id: string, book: { title: string; author: string; genre: string; description?: string; coverUrl?: string }) => {
      const supabase = createClient();
      await (supabase.from("library_books") as any)
        .update({
          title: book.title,
          author: book.author,
          genre: book.genre,
          description: book.description ?? null,
          cover_url: book.coverUrl ?? null,
        })
        .eq("id", id);
      refetch();
    },
    [refetch]
  );

  const deleteBook = useCallback(
    async (id: string) => {
      const supabase = createClient();
      await (supabase.from("library_books") as any).delete().eq("id", id);
      refetch();
    },
    [refetch]
  );

  const requestBorrow = useCallback(
    async (book: LibraryBook, borrower: Borrower) => {
      if (!profile) return;
      const supabase = createClient();

      await (supabase.from("library_borrow_requests") as any).insert({
        school_id: profile.school_id,
        book_id: book.id,
        student_id: borrower.id,
        status: "pending",
      });

      await (supabase.from("library_books") as any)
        .update({ status: "requested", borrowed_by: borrower.id, borrowed_by_name: borrower.name })
        .eq("id", book.id);

      if (librarian) {
        sendSystemMessage(
          "student",
          librarian.id,
          librarian.name,
          librarian.initials,
          `We received your request for "${book.title}". We'll message you the pickup time once it's approved.`
        );
      }

      refetch();
    },
    [profile, librarian, sendSystemMessage, refetch]
  );

  const approveRequest = useCallback(
    async (requestId: string, pickupWindow: string) => {
      if (!profile) return;
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;
      const supabase = createClient();

      await (supabase.from("library_books") as any)
        .update({ status: "borrowed", borrowed_date: todayISO(), due_date: addDaysISO(14) })
        .eq("id", request.bookId);

      await (supabase.from("library_borrow_log") as any).insert({
        school_id: profile.school_id,
        book_id: request.bookId,
        student_id: request.studentId,
        action: "borrowed",
      });

      await (supabase.from("library_borrow_requests") as any)
        .update({ status: "approved" })
        .eq("id", requestId);

      if (librarian) {
        sendSystemMessage(
          "student",
          librarian.id,
          librarian.name,
          librarian.initials,
          `Good news! "${request.bookTitle}" is ready for pickup: ${pickupWindow}.`
        );
      }

      refetch();
    },
    [profile, requests, librarian, sendSystemMessage, refetch]
  );

  const declineRequest = useCallback(
    async (requestId: string) => {
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;
      const supabase = createClient();

      await (supabase.from("library_books") as any)
        .update({ status: "available", borrowed_by: null, borrowed_by_name: null })
        .eq("id", request.bookId);

      await (supabase.from("library_borrow_requests") as any)
        .update({ status: "declined" })
        .eq("id", requestId);

      if (librarian) {
        sendSystemMessage(
          "student",
          librarian.id,
          librarian.name,
          librarian.initials,
          `Sorry, we couldn't approve your request for "${request.bookTitle}" right now. Please check back later.`
        );
      }

      refetch();
    },
    [requests, librarian, sendSystemMessage, refetch]
  );

  const returnBook = useCallback(
    async (bookId: string) => {
      if (!profile) return;
      const supabase = createClient();

      const openLogEntry = log.find((entry) => entry.bookId === bookId && !entry.returnedDate);

      await (supabase.from("library_books") as any)
        .update({ status: "available", borrowed_by: null, borrowed_by_name: null, borrowed_date: null, due_date: null })
        .eq("id", bookId);

      if (openLogEntry) {
        await (supabase.from("library_borrow_log") as any).insert({
          school_id: profile.school_id,
          book_id: bookId,
          student_id: openLogEntry.studentId,
          action: "returned",
        });
      }

      refetch();
    },
    [profile, log, refetch]
  );

  const historyForBook = useCallback(
    (bookTitle: string) => {
      const normalized = bookTitle.trim().toLowerCase();
      if (!normalized) return [];
      return log.filter((entry) => entry.bookTitle.toLowerCase().includes(normalized));
    },
    [log]
  );

  const value = useMemo(
    () => ({ books, requests, log, loading, error, addBook, updateBook, deleteBook, requestBorrow, approveRequest, declineRequest, returnBook, historyForBook }),
    [books, requests, log, loading, error, addBook, updateBook, deleteBook, requestBorrow, approveRequest, declineRequest, returnBook, historyForBook]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryStore() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryStore must be used within a LibraryProvider");
  return ctx;
}
