"use client";

interface MyDayModalProps {
  name: string;
  image: string;
  note: string;
  isOwner: boolean;
  viewers?: string[];
  onNoteChange?: (note: string) => void;
  onClose: () => void;
}

export function MyDayModal({ name, image, note, isOwner, viewers, onNoteChange, onClose }: MyDayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="animate-modal-in w-full max-w-sm overflow-hidden rounded-3xl border-2 border-gold bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[3/4] w-full bg-navy">
          <img src={image} alt={`${name}'s Day`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
          >
            ✕
          </button>
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
            {name}
          </span>
        </div>

        <div className="p-5">
          {isOwner ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your note</p>
              <input
                value={note}
                onChange={(e) => onNoteChange?.(e.target.value)}
                placeholder="Share what's on your mind..."
                maxLength={60}
                className="mt-2 w-full rounded-2xl border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
              />

              {viewers && viewers.length > 0 && (
                <div className="mt-4 border-t border-base pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Viewed by {viewers.length}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewers.map((v) => (
                      <span key={v} className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-navy">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            note && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Note</p>
                <p className="mt-2 text-sm text-navy">{note}</p>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
