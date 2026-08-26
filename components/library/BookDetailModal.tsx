"use client";

import { Modal } from "@/components/ui/Modal";
import { Chip } from "@/components/ui/Chip";
import { BookCover } from "@/components/library/BookCover";
import { LibraryBook } from "@/types/student";

/**
 * Shared status presentation for library books. Single source of truth for
 * both the catalog row chips and the read-only detail modal, so student and
 * teacher surfaces never drift apart.
 *
 * `isMine` only matters in the student context ("Pending approval" / "Due
 * ..." for the student's own request/loan); teacher rows never pass it.
 */
export type BookStatusVariant = "success" | "warn" | "neutral";

export function bookStatusChip(
  book: LibraryBook,
  isMine: boolean,
  context: "student" | "teacher"
): { variant: BookStatusVariant; label: string } {
  if (book.status === "available") return { variant: "success", label: "Available" };
  if (book.status === "requested") {
    if (context === "student" && isMine) return { variant: "warn", label: "Pending approval" };
    return { variant: "warn", label: "Requested" };
  }
  if (context === "student" && isMine) return { variant: "neutral", label: `Due ${book.dueDate}` };
  return { variant: "neutral", label: "Borrowed" };
}

/** Muted detail line under the status chip, scoped by context. */
export function bookStatusLine(book: LibraryBook, isMine: boolean, context: "student" | "teacher"): string | null {
  if (book.status === "available") return null;
  if (context === "student") {
    if (book.status === "requested") return isMine ? "Pending librarian approval" : "Requested by another student";
    return isMine ? `Due ${book.dueDate}` : "Currently borrowed";
  }
  // Teacher context - loan information is part of the librarian's data.
  if (book.status === "requested") return "Pickup request pending approval";
  return book.borrowedByName
    ? `Loaned to ${book.borrowedByName} · borrowed ${book.borrowedDate ?? "—"} · due ${book.dueDate ?? "—"}`
    : "Currently borrowed";
}

function splitGenres(genre: string): string[] {
  return genre
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

export interface BookDetailModalProps {
  book: LibraryBook;
  onClose: () => void;
  /** Only meaningful in the student context - marks the student's own request/loan. */
  isMine?: boolean;
  /** Scopes copy: students never see borrower identity; teachers see loan info. */
  context?: "student" | "teacher";
  /** Optional page-level action slot (e.g. the student's Request-to-borrow button). */
  action?: React.ReactNode;
}

/**
 * Read-only book detail surface shared by Student Library and Teacher Library
 * Management. Displays only existing LibraryBook fields - no management
 * controls live here. Actions (borrow / edit / approve / delete) stay at the
 * page level and are passed in through the `action` slot.
 */
export function BookDetailModal({
  book,
  onClose,
  isMine = false,
  context = "student",
  action,
}: BookDetailModalProps) {
  const chip = bookStatusChip(book, isMine, context);
  const line = bookStatusLine(book, isMine, context);

  return (
    <Modal onClose={onClose} eyebrow={splitGenres(book.genre).join(" · ") || "Library"} description={book.title}>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <BookCover book={book} size="lg" />
        <div className="min-w-0">
          <h2 className="line-clamp-2 font-display text-2xl font-bold text-navy">{book.title}</h2>
          <p className="mt-1 text-sm text-muted">by {book.author}</p>
          {book.isbn && (
            <p className="mt-1 font-mono-ui text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
              ISBN · {book.isbn}
            </p>
          )}
        </div>
      </div>

      {book.description && <p className="mt-4 text-sm leading-6 text-muted">{book.description}</p>}

      <div className="mt-5 border-t border-base pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Chip variant={chip.variant}>{chip.label}</Chip>
          {line && <span className="text-xs leading-5 text-muted">{line}</span>}
        </div>
      </div>

      {action && <div className="mt-5">{action}</div>}
    </Modal>
  );
}
