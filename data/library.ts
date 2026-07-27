import { LibraryBorrowLogEntry, LibraryBorrowRequest } from "@/types/student";

// TEMP: this represents the full, school-wide borrowing history across every
// student (not just the signed-in one). Once Supabase is wired up, this
// becomes a `library_borrow_log` table the librarian can query by book.
export const LIBRARY_BORROW_LOG_SEED: LibraryBorrowLogEntry[] = [
  {
    id: "log-1",
    bookId: "bk-002",
    bookTitle: "Science Explorer: Physics",
    studentId: "s-001",
    studentName: "Miguel Santos",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-07-03",
  },
  {
    id: "log-2",
    bookId: "bk-004",
    bookTitle: "Accelerated Math Challenges",
    studentId: "s-001",
    studentName: "Miguel Santos",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-07-01",
  },
  {
    id: "log-3",
    bookId: "bk-010",
    bookTitle: "Philippine Folk Tales",
    studentId: "s-010",
    studentName: "Andrea Cruz",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-06-10",
    returnedDate: "2026-06-22",
  },
  {
    id: "log-4",
    bookId: "bk-006",
    bookTitle: "Introduction to Robotics",
    studentId: "s-022",
    studentName: "Carlo Dizon",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-05-28",
    returnedDate: "2026-06-09",
  },
  {
    id: "log-5",
    bookId: "bk-001",
    bookTitle: "The Secret Garden",
    studentId: "s-031",
    studentName: "Ella Ramos",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-05-05",
    returnedDate: "2026-05-17",
  },
  {
    id: "log-6",
    bookId: "bk-001",
    bookTitle: "The Secret Garden",
    studentId: "s-042",
    studentName: "Jomar Villa",
    gradeSection: "Grade 10 · Zeus",
    borrowedDate: "2026-04-10",
    returnedDate: "2026-04-24",
  },
];

// TEMP: pending pickup requests waiting on librarian approval. Seeded with
// one example so the Library Management screen has something to show.
export const LIBRARY_BORROW_REQUESTS_SEED: LibraryBorrowRequest[] = [
  {
    id: "req-lib-seed-1",
    bookId: "bk-005",
    bookTitle: "The Grammar Companion",
    studentId: "s-014",
    studentName: "Bea Reyes",
    gradeSection: "Grade 10 · Zeus",
    requestedAt: "2026-07-24 09:10 AM",
  },
];
