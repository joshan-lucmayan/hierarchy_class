"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { BookCover } from "@/components/library/BookCover";
import { useLibraryStore } from "@/lib/libraryStore";
import { LibraryBook } from "@/types/student";

type Mode = "scan" | "manual";
type ScanInput = "camera" | "device";
type ScanState = "idle" | "scanning" | "looking-up" | "found" | "not-found" | "camera-error";

interface BookDraft {
  title: string;
  author: string;
  genre: string;
  description: string;
  coverUrl: string;
  isbn: string;
  location: string;
}

const EMPTY_DRAFT: BookDraft = { title: "", author: "", genre: "", description: "", coverUrl: "", isbn: "", location: "" };
const SCANNER_ELEMENT_ID = "book-barcode-scanner";

export function AddBookModal({ onClose }: { onClose: () => void }) {
  const { addBook } = useLibraryStore();
  const [mode, setMode] = useState<Mode>("scan");
  const [scanInput, setScanInput] = useState<ScanInput>("camera");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [draft, setDraft] = useState<BookDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [deviceBuffer, setDeviceBuffer] = useState("");
  const [scanRetry, setScanRetry] = useState(0);
  const scannerRef = useRef<any>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "scan" || scanInput !== "camera" || scanState === "found") return;

    let cancelled = false;
    setScanState("scanning");

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decodedText: string) => {
            handleIsbnDetected(decodedText);
          },
          () => {
            // per-frame "not found yet" - ignore, this fires constantly while scanning
          }
        )
        .catch(() => {
          if (!cancelled) setScanState("camera-error");
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scanInput, scanRetry]);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // ignore
      }
    }
  }

  async function handleIsbnDetected(rawIsbn: string) {
    const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");
    if (!isbn) return;
    await stopScanner();
    setDeviceBuffer("");
    setScanState("looking-up");

    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
      );
      const data = await res.json();
      const info = data[`ISBN:${isbn}`];

      if (!info) {
        setDraft({ ...EMPTY_DRAFT, isbn });
        setScanState("not-found");
        return;
      }

      setDraft({
        title: info.title ?? "",
        author: (info.authors ?? []).map((a: any) => a.name).join(", "),
        genre: (info.subjects ?? []).slice(0, 1).map((s: any) => s.name).join("") || "",
        description: info.notes ? (typeof info.notes === "string" ? info.notes : "") : "",
        coverUrl: info.cover?.large ?? info.cover?.medium ?? "",
        isbn,
        location: "",
      });
      setScanState("found");
    } catch {
      setDraft({ ...EMPTY_DRAFT, isbn });
      setScanState("not-found");
    }
  }

  function handleRetryScan() {
    setDraft(EMPTY_DRAFT);
    setDeviceBuffer("");
    setScanState("idle");
    // The scanner effect keys on [mode, scanInput] and would not re-run when
    // scanState returns to "idle" - bump this counter so "Scan again"
    // actually restarts the camera instead of leaving an empty box.
    setScanRetry((t) => t + 1);
    if (scanInput === "device") {
      setTimeout(() => deviceInputRef.current?.focus(), 0);
    }
  }

  function handleDeviceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = deviceBuffer.trim();
      if (code) handleIsbnDetected(code);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.author.trim()) return;
    setSubmitting(true);
    await addBook({
      title: draft.title.trim(),
      author: draft.author.trim(),
      genre: draft.genre.trim() || "Uncategorized",
      description: draft.description.trim() || undefined,
      coverUrl: draft.coverUrl.trim() || undefined,
      isbn: draft.isbn.trim() || undefined,
      location: draft.location.trim() || undefined,
    });
    setSubmitting(false);
    onClose();
  }

  async function handleClose() {
    await stopScanner();
    onClose();
  }

  const showReviewForm = mode === "manual" || scanState === "found" || scanState === "not-found";

  const inputCls =
    "w-full rounded-[10px] border border-base bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-gold";
  const fieldLabel = "font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint";

  return (
    <Modal onClose={handleClose} eyebrow="Library" description="Add a book to the school catalog">
      {/* Entry mode: scan a barcode or enter the details manually */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => { setMode("scan"); setScanState("idle"); setDraft(EMPTY_DRAFT); }}
          className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
            mode === "scan" ? "bg-gold-token text-on-accent" : "border border-base text-muted hover:border-gold-soft hover:text-gold-token"
          }`}
        >
          Scan barcode
        </button>
        <button
          type="button"
          onClick={async () => { await stopScanner(); setMode("manual"); setDraft(EMPTY_DRAFT); }}
          className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
            mode === "manual" ? "bg-gold-token text-on-accent" : "border border-base text-muted hover:border-gold-soft hover:text-gold-token"
          }`}
        >
          Enter manually
        </button>
      </div>

      {mode === "scan" && (
        <>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => { setScanInput("camera"); setScanState("idle"); setDraft(EMPTY_DRAFT); }}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                scanInput === "camera" ? "border border-gold-token text-gold-token" : "border border-base text-muted hover:border-gold-soft hover:text-gold-token"
              }`}
            >
              Use camera
            </button>
            <button
              type="button"
              onClick={async () => {
                await stopScanner();
                setScanInput("device");
                setScanState("idle");
                setDraft(EMPTY_DRAFT);
                setTimeout(() => deviceInputRef.current?.focus(), 0);
              }}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                scanInput === "device" ? "border border-gold-token text-gold-token" : "border border-base text-muted hover:border-gold-soft hover:text-gold-token"
              }`}
            >
              Use scanner device
            </button>
          </div>

          {scanInput === "camera" && !showReviewForm && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-muted">
                Point the camera at the barcode on the back of the book (the ISBN barcode).
              </p>
              <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-[10px] border border-base" />
              {scanState === "looking-up" && (
                <p className="text-center text-xs text-muted">Looking up book details...</p>
              )}
              {scanState === "camera-error" && (
                <p className="text-center text-xs text-warn">
                  Couldn&apos;t access the camera. Check your browser permissions, or switch to manual entry.
                </p>
              )}
            </div>
          )}

          {scanInput === "device" && !showReviewForm && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-muted">
                Plug in or connect your barcode scanner, click the box below, then scan the book&apos;s barcode.
                Most scanners act like a keyboard, so no special setup is needed.
              </p>
              <input
                ref={deviceInputRef}
                value={deviceBuffer}
                onChange={(e) => setDeviceBuffer(e.target.value)}
                onKeyDown={handleDeviceKeyDown}
                autoFocus
                aria-label="Barcode scanner input - waiting for scan"
                placeholder="Waiting for scan..."
                className="w-full rounded-[10px] border-2 border-dashed border-gold-token bg-[var(--surface-strong)] px-4 py-3 text-center text-sm text-navy outline-none focus:border-gold"
              />
              {scanState === "looking-up" && (
                <p className="text-center text-xs text-muted">Looking up book details...</p>
              )}
            </div>
          )}
        </>
      )}

      {showReviewForm && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {scanState === "not-found" && (
            <p className="rounded-[10px] border border-gold-soft bg-gold-soft px-3 py-2.5 text-xs text-gold-token">
              Couldn&apos;t find that ISBN online - fill in the details below manually.
            </p>
          )}
          {scanState === "found" && (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-gold-soft bg-gold-soft px-3 py-2.5">
              <p className="text-xs text-gold-token">Found it! Review the details below before saving.</p>
              <button type="button" onClick={handleRetryScan} className="shrink-0 text-xs font-semibold text-gold-token underline">
                Scan again
              </button>
            </div>
          )}

          <h3 className="section-label">Book information</h3>
          <div className="flex gap-4">
            <BookCover book={{ coverUrl: draft.coverUrl || undefined } as LibraryBook} size="lg" />
            <div className="flex-1 space-y-2">
              <label htmlFor="add-book-title" className={fieldLabel}>Title</label>
              <input
                id="add-book-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Title"
                required
                className={inputCls}
              />
              <label htmlFor="add-book-author" className={fieldLabel}>Author</label>
              <input
                id="add-book-author"
                value={draft.author}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                placeholder="Author"
                required
                className={inputCls}
              />
            </div>
          </div>

          <label htmlFor="add-book-genre" className={fieldLabel}>Genre</label>
          <input
            id="add-book-genre"
            value={draft.genre}
            onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
            placeholder="Genre"
            className={inputCls}
          />
          <label htmlFor="add-book-description" className={fieldLabel}>Description</label>
          <textarea
            id="add-book-description"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={3}
            className={inputCls}
          />
          <label htmlFor="add-book-cover" className={fieldLabel}>Cover image URL</label>
          <input
            id="add-book-cover"
            value={draft.coverUrl}
            onChange={(e) => setDraft((d) => ({ ...d, coverUrl: e.target.value }))}
            placeholder="Cover image URL (optional)"
            className={inputCls}
          />
          {draft.isbn && <p className="font-mono-ui text-[10px] uppercase tracking-[0.1em] text-muted">ISBN · {draft.isbn}</p>}
          <label htmlFor="add-book-location" className={fieldLabel}>Location in library</label>
          <input
            id="add-book-location"
            value={draft.location}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
            placeholder="e.g. Shelf A2, Rack 3 (optional)"
            className={inputCls}
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              variant="gold"
              className="flex-1"
              icon={<IconPlus size={13} />}
              disabled={submitting || !draft.title.trim() || !draft.author.trim()}
              loading={submitting}
            >
              {submitting ? "Adding..." : "Add book"}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
