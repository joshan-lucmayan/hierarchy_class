"use client";

import { useEffect, useRef, useState } from "react";
import { useLibraryStore } from "@/lib/libraryStore";

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
}

const EMPTY_DRAFT: BookDraft = { title: "", author: "", genre: "", description: "", coverUrl: "", isbn: "" };
const SCANNER_ELEMENT_ID = "book-barcode-scanner";

export function AddBookModal({ onClose }: { onClose: () => void }) {
  const { addBook } = useLibraryStore();
  const [mode, setMode] = useState<Mode>("scan");
  const [scanInput, setScanInput] = useState<ScanInput>("camera");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [draft, setDraft] = useState<BookDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [deviceBuffer, setDeviceBuffer] = useState("");
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
  }, [mode, scanInput]);

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
    });
    setSubmitting(false);
    onClose();
  }

  async function handleClose() {
    await stopScanner();
    onClose();
  }

  const showReviewForm = mode === "manual" || scanState === "found" || scanState === "not-found";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-base bg-surface p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Add a book</p>
          <button type="button" onClick={handleClose} className="text-muted transition hover:text-navy">✕</button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setMode("scan"); setScanState("idle"); setDraft(EMPTY_DRAFT); }}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "scan" ? "bg-gold text-on-accent" : "border border-base text-muted hover:border-gold hover:text-gold"
            }`}
          >
            Scan barcode
          </button>
          <button
            type="button"
            onClick={async () => { await stopScanner(); setMode("manual"); setDraft(EMPTY_DRAFT); }}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "manual" ? "bg-gold text-on-accent" : "border border-base text-muted hover:border-gold hover:text-gold"
            }`}
          >
            Enter manually
          </button>
        </div>

        {mode === "scan" && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => { setScanInput("camera"); setScanState("idle"); setDraft(EMPTY_DRAFT); }}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                scanInput === "camera" ? "border border-gold text-gold" : "border border-base text-muted hover:border-gold hover:text-gold"
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
                scanInput === "device" ? "border border-gold text-gold" : "border border-base text-muted hover:border-gold hover:text-gold"
              }`}
            >
              Use scanner device
            </button>
          </div>
        )}

        {mode === "scan" && scanInput === "camera" && !showReviewForm && (
          <div className="mt-5 space-y-3">
            <p className="text-xs text-muted">
              Point the camera at the barcode on the back of the book (the ISBN barcode).
            </p>
            <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-[10px] border border-base" />
            {scanState === "looking-up" && (
              <p className="text-center text-xs text-muted">Looking up book details...</p>
            )}
            {scanState === "camera-error" && (
              <p className="text-center text-xs text-red-500">
                Couldn&apos;t access the camera. Check your browser permissions, or switch to manual entry.
              </p>
            )}
          </div>
        )}

        {mode === "scan" && scanInput === "device" && !showReviewForm && (
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
              placeholder="Waiting for scan..."
              className="w-full rounded-[10px] border-2 border-dashed border-gold bg-[var(--surface-strong)] px-4 py-3 text-center text-sm text-navy outline-none"
            />
            {scanState === "looking-up" && (
              <p className="text-center text-xs text-muted">Looking up book details...</p>
            )}
          </div>
        )}

        {showReviewForm && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {scanState === "not-found" && (
              <p className="rounded-[10px] bg-gold/10 px-3 py-2 text-xs text-navy">
                Couldn&apos;t find that ISBN online — fill in the details below manually.
              </p>
            )}
            {scanState === "found" && (
              <div className="flex items-center justify-between rounded-[10px] bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-emerald-700">Found it! Review the details below before saving.</p>
                <button type="button" onClick={handleRetryScan} className="text-xs font-semibold text-emerald-700 underline">
                  Scan again
                </button>
              </div>
            )}

            <div className="flex gap-4">
              {draft.coverUrl && (
                <img src={draft.coverUrl} alt="" className="h-28 w-20 shrink-0 rounded-lg border border-base object-cover" />
              )}
              <div className="flex-1 space-y-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Title"
                  required
                  className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
                <input
                  value={draft.author}
                  onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                  placeholder="Author"
                  required
                  className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
            </div>

            <input
              value={draft.genre}
              onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
              placeholder="Genre"
              className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={3}
              className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            />
            <input
              value={draft.coverUrl}
              onChange={(e) => setDraft((d) => ({ ...d, coverUrl: e.target.value }))}
              placeholder="Cover image URL (optional)"
              className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            />
            {draft.isbn && <p className="text-xs text-muted">ISBN: {draft.isbn}</p>}

            <button
              type="submit"
              disabled={submitting || !draft.title.trim() || !draft.author.trim()}
              className="w-full rounded-full bg-navy py-2.5 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:opacity-40"
            >
              {submitting ? "Adding..." : "Add to library"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
