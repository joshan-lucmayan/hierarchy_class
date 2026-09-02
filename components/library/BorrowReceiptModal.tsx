"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconX } from "@/components/ui/icons";
import { BorrowReceipt } from "@/types/student";
import { formatPeso } from "@/lib/libraryUtils";

/**
 * Printable borrow receipt. Shows every relevant detail of a loan (book,
 * borrower, dates, requested days, and any overdue fine) in a receipt-style
 * layout. The "Print" button triggers window.print(); a scoped <style> hides
 * everything except this dialog when printing.
 */
export function BorrowReceiptModal({
  receipt,
  onClose,
}: {
  receipt: BorrowReceipt;
  onClose: () => void;
}) {
  const rowCls = "flex items-start justify-between gap-4 py-1.5 text-sm";
  const labelCls = "shrink-0 text-muted";
  const valueCls = "text-right font-semibold text-navy";

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #borrow-receipt, #borrow-receipt * { visibility: visible !important; }
          #borrow-receipt { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-height: none !important; overflow: visible !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
      <Modal onClose={onClose} eyebrow={receipt.schoolName || "Library"} description="Borrow receipt" maxWidth="max-w-md">
        <div id="borrow-receipt" className="mt-4 rounded-[10px] border border-base bg-surface p-5">
          {/* Header */}
          <div className="border-b border-base pb-3 text-center">
            <p className="font-display text-lg font-bold text-navy">{receipt.schoolName || "School Library"}</p>
            <p className="mt-0.5 font-mono-ui text-[10px] uppercase tracking-[0.2em] text-muted">
              Official borrow receipt
            </p>
            <p className="mt-1 font-mono-ui text-[10px] text-muted">Receipt No. {receipt.receiptNo}</p>
          </div>

          {/* Book + borrower */}
          <div className="mt-3 space-y-1">
            <div className={rowCls}>
              <span className={labelCls}>Book</span>
              <span className={`${valueCls} max-w-[60%]`}>{receipt.bookTitle}</span>
            </div>
            {receipt.bookAuthor && (
              <div className={rowCls}>
                <span className={labelCls}>Author</span>
                <span className={`${valueCls} max-w-[60%]`}>{receipt.bookAuthor}</span>
              </div>
            )}
            {receipt.genre && (
              <div className={rowCls}>
                <span className={labelCls}>Genre</span>
                <span className={`${valueCls} max-w-[60%]`}>{receipt.genre}</span>
              </div>
            )}
            {receipt.location && (
              <div className={rowCls}>
                <span className={labelCls}>Location</span>
                <span className={`${valueCls} max-w-[60%]`}>{receipt.location}</span>
              </div>
            )}
            <div className={rowCls}>
              <span className={labelCls}>Borrower</span>
              <span className={`${valueCls} max-w-[60%]`}>{receipt.studentName}</span>
            </div>
            {receipt.gradeSection && (
              <div className={rowCls}>
                <span className={labelCls}>Grade / Section</span>
                <span className={`${valueCls} max-w-[60%]`}>{receipt.gradeSection}</span>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="mt-3 space-y-1 border-t border-base pt-3">
            <div className={rowCls}>
              <span className={labelCls}>Borrowed</span>
              <span className={valueCls}>{receipt.borrowedDate || "—"}</span>
            </div>
            {receipt.dueDate && (
              <div className={rowCls}>
                <span className={labelCls}>Due date</span>
                <span className={valueCls}>{receipt.dueDate}</span>
              </div>
            )}
            {receipt.returnedDate && (
              <div className={rowCls}>
                <span className={labelCls}>Returned</span>
                <span className={valueCls}>{receipt.returnedDate}</span>
              </div>
            )}
          </div>

          {/* Fine summary */}
          <div className="mt-3 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
            <div className={rowCls}>
              <span className={labelCls}>Overdue</span>
              <span className={valueCls}>
                {receipt.overdueDays > 0 ? `${receipt.overdueDays} day${receipt.overdueDays === 1 ? "" : "s"}` : "None"}
              </span>
            </div>
            <div className={rowCls}>
              <span className={labelCls}>Late fine</span>
              <span className={receipt.fineAmount > 0 ? "text-right font-semibold text-warn" : "text-right font-semibold text-navy"}>
                {receipt.fineAmount > 0 ? formatPeso(receipt.fineAmount) : "—"}
              </span>
            </div>
            {receipt.fineAmount > 0 && (
              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                ₱10 per day for every day past the due date. Please settle your fine at the library desk.
              </p>
            )}
          </div>

          <p className="mt-4 text-center font-mono-ui text-[10px] uppercase tracking-[0.12em] text-faint">
            Thank you for using the school library
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            variant="gold"
            className="flex-1"
            icon={<IconCheck size={13} />}
            onClick={() => window.print()}
          >
            Print receipt
          </Button>
          <Button variant="outline" icon={<IconX size={13} />} onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
