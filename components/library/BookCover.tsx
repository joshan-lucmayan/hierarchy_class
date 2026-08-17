"use client";

import { useState } from "react";
import { LibraryBook } from "@/types/student";

/**
 * Shared book cover renderer: coverUrl image when present (with a graceful
 * fallback on load failure), otherwise a quiet "No cover" tile. Used by the
 * student catalog, the teacher catalog, and the read-only BookDetailModal so
 * the cover treatment stays identical everywhere.
 */
export function BookCover({ book, size = "sm" }: { book: LibraryBook; size?: "sm" | "lg" }) {
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={book.coverUrl}
      alt=""
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 rounded-lg border border-base object-cover`}
    />
  );
}
