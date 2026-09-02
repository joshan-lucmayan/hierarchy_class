"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { LibraryBook, LibraryBorrowLogEntry, LibraryBorrowRequest, BorrowReceipt } from "@/types/student";
import { notifyUser } from "@/lib/notify";
import { FINE_PER_DAY, fineFor, overdueDays } from "@/lib/libraryUtils";

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
  schoolName: string;
  loading: boolean;
  error: string | null;
  addBook: (book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; isbn?: string; location?: string }) => Promise<void>;
  updateBook: (id: string, book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; location?: string }) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  requestBorrow: (book: LibraryBook, borrower: Borrower, days?: number) => Promise<void>;
  approveRequest: (requestId: string, pickupWindow: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  returnBook: (bookId: string) => Promise<void>;
  historyForBook: (bookTitle: string) => LibraryBorrowLogEntry[];
  receiptForBook: (book: LibraryBook) => BorrowReceipt;
  receiptForLog: (entry: LibraryBorrowLogEntry) => BorrowReceipt;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const librarian = useLibrarian();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [requests, setRequests] = useState<LibraryBorrowRequest[]>([]);
  const [log, setLog] = useState<LibraryBorrowLogEntry[]>([]);
  const [schoolName, setSchoolName] = useState("");
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

    const schoolId = profile.school_id;
    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [
        { data: booksData, error: booksErr },
        { data: requestsData, error: requestsErr },
        { data: logData, error: logErr },
        { data: schoolData, error: schoolErr },
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
        supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      ])) as any[];

      if (cancelled) return;

      if (booksErr || requestsErr || logErr || schoolErr) {
        setError("Couldn't load library data. Please refresh and try again.");
        setLoading(false);
        return;
      }

      if (schoolData?.name) setSchoolName(schoolData.name);

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
          location: b.location ?? undefined,
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
          requestedDays: r.requested_days ?? 7,
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
            dueDate: borrowRow.due_date ? borrowRow.due_date.slice(0, 10) : undefined,
            returnedDate: returnRow?.date ? returnRow.date.slice(0, 10) : undefined,
            overdueDays: returnRow?.overdue_days ?? 0,
            fineAmount: returnRow?.fine_amount ?? 0,
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
    async (book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; isbn?: string; location?: string }) => {
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
        location: book.location ?? null,
        status: "available",
      });
      refetch();
    },
    [profile, refetch]
  );

  const updateBook = useCallback(
    async (id: string, book: { title: string; author: string; genre: string; description?: string; coverUrl?: string; location?: string }) => {
      const supabase = createClient();
      await (supabase.from("library_books") as any)
        .update({
          title: book.title,
          author: book.author,
          genre: book.genre,
          description: book.description ?? null,
          cover_url: book.coverUrl ?? null,
          location: book.location ?? null,
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
    async (book: LibraryBook, borrower: Borrower, days?: number) => {
      if (!profile) return;
      const supabase = createClient();

      // Privileged two-step write (insert request + flip book to "requested")
      // runs server-side in a SECURITY DEFINER function - students cannot
      // UPDATE library_books under RLS (books_teacher_update is teacher-only).
      await (supabase as any).rpc("request_library_book", {
        p_book_id: book.id,
        p_days: days ?? 7,
      });

      if (librarian) {
        await notifyUser(
          librarian.id,
          "library",
          "New book request",
          `${borrower.name} requested "${book.title}" for ${days ?? 7} days.`,
          `/teacher/library-management?book=${book.id}`
        );
      }

      refetch();
    },
    [profile, librarian, refetch]
  );

  const approveRequest = useCallback(
    async (requestId: string, pickupWindow: string) => {
      if (!profile) return;
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;
      const supabase = createClient();

      const days = Math.max(1, request.requestedDays ?? 7);
      const dueDate = addDaysISO(days);

      await (supabase.from("library_books") as any)
        .update({ status: "borrowed", borrowed_date: todayISO(), due_date: dueDate })
        .eq("id", request.bookId);

      await (supabase.from("library_borrow_log") as any).insert({
        school_id: profile.school_id,
        book_id: request.bookId,
        student_id: request.studentId,
        action: "borrowed",
        due_date: dueDate,
      });

      await (supabase.from("library_borrow_requests") as any)
        .update({ status: "approved" })
        .eq("id", requestId);

      const book = books.find((b) => b.id === request.bookId);
      await notifyUser(
        request.studentId,
        "library",
        "Book ready for pickup",
        `"${request.bookTitle}" is ready: ${pickupWindow}. Due in ${days} days${
          book?.location ? ` · Located at ${book.location}` : ""
        }.`,
        `/student/library?book=${request.bookId}`
      );

      refetch();
    },
    [profile, requests, books, refetch]
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

      await notifyUser(
        request.studentId,
        "library",
        "Book request declined",
        `We couldn't approve "${request.bookTitle}" right now. Please check back later.`,
        `/student/library?book=${request.bookId}`
      );

      refetch();
    },
    [requests, refetch]
  );

  const returnBook = useCallback(
    async (bookId: string) => {
      if (!profile) return;
      const supabase = createClient();

      const book = books.find((b) => b.id === bookId);
      const openLogEntry = log.find((entry) => entry.bookId === bookId && !entry.returnedDate);

      await (supabase.from("library_books") as any)
        .update({ status: "available", borrowed_by: null, borrowed_by_name: null, borrowed_date: null, due_date: null })
        .eq("id", bookId);

      if (openLogEntry) {
        const dueDate = openLogEntry.dueDate ?? book?.dueDate;
        const fine = fineFor(dueDate);
        const overdue = fine > 0 ? Math.ceil(fine / FINE_PER_DAY) : 0;

        await (supabase.from("library_borrow_log") as any).insert({
          school_id: profile.school_id,
          book_id: bookId,
          student_id: openLogEntry.studentId,
          action: "returned",
          overdue_days: overdue,
          fine_amount: fine,
        });
      }

      refetch();
    },
    [profile, books, log, refetch]
  );

  const receiptForBook = useCallback(
    (book: LibraryBook): BorrowReceipt => ({
      receiptNo: book.id,
      schoolName,
      bookTitle: book.title,
      bookAuthor: book.author,
      genre: book.genre,
      location: book.location,
      studentName: book.borrowedByName ?? "—",
      borrowedDate: book.borrowedDate ?? "",
      dueDate: book.dueDate,
      overdueDays: overdueDays(book.dueDate),
      fineAmount: fineFor(book.dueDate),
    }),
    [schoolName]
  );

  const receiptForLog = useCallback(
    (entry: LibraryBorrowLogEntry): BorrowReceipt => ({
      receiptNo: entry.id,
      schoolName,
      bookTitle: entry.bookTitle,
      bookAuthor: "",
      genre: "",
      studentName: entry.studentName,
      gradeSection: entry.gradeSection,
      borrowedDate: entry.borrowedDate,
      dueDate: entry.dueDate,
      returnedDate: entry.returnedDate,
      overdueDays: entry.overdueDays ?? 0,
      fineAmount: entry.fineAmount ?? 0,
    }),
    [schoolName]
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
    () => ({
      books,
      requests,
      log,
      schoolName,
      loading,
      error,
      addBook,
      updateBook,
      deleteBook,
      requestBorrow,
      approveRequest,
      declineRequest,
      returnBook,
      historyForBook,
      receiptForBook,
      receiptForLog,
    }),
    [books, requests, log, schoolName, loading, error, addBook, updateBook, deleteBook, requestBorrow, approveRequest, declineRequest, returnBook, historyForBook, receiptForBook, receiptForLog]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryStore() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryStore must be used within a LibraryProvider");
  return ctx;
}
