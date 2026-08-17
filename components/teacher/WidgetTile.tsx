"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGrip, IconX, IconResizeCorner } from "@/components/ui/icons";
import {
  WIDGET_SIZES,
  SIZE_COLUMNS,
  SPAN_CLASS,
  type WidgetSize,
} from "@/lib/dashboardShared";

export { SPAN_CLASS };

export interface WidgetTileProps {
  id: string;
  label: string;
  size: WidgetSize;
  tall: boolean;
  /** Sizes this widget may cycle through (defaults to all four). */
  allowedSizes?: WidgetSize[];
  onRemove: () => void;
  onSizeChange: (size: WidgetSize) => void;
  onTallChange: (tall: boolean) => void;
  children: React.ReactNode;
}

/** The drag threshold (px) before a resize handle changes size/tall. */
const RESIZE_STEP_PX = 36;

/** How close (px) the pointer must be to a card corner to reveal it. */
const CORNER_REVEAL_PX = 40;

/** Which resize axis a handle controls. */
type ResizeAxis = "n" | "e" | "s" | "w" | "corner";

/** Card corners, for diagonal (both-axis) resize. */
type Corner = "nw" | "ne" | "sw" | "se";

function stepSize(current: WidgetSize, dir: 1 | -1, allowed: WidgetSize[]): WidgetSize {
  const idx = allowed.indexOf(current);
  if (idx < 0) return allowed[0];
  const next = Math.min(allowed.length - 1, Math.max(0, idx + dir));
  return allowed[next];
}

/**
 * Edit-mode chrome for one dashboard tile. The tile participates in the SAME
 * CSS Grid as view mode - this wrapper only adds controls:
 *
 * - The top bar is the @dnd-kit drag handle. Dragging it REORDERS the
 *   widget (the transform is temporary and disappears on drop); it is also
 *   keyboard-operable (Tab to the strip, Space to pick up, arrows to move).
 * - Resize handles are revealed only when needed, so a resting card stays
 *   clean: hovering the card shows the four mid-edge pills (N/E/S/W);
 *   moving the pointer directly onto a card corner reveals that corner for
 *   diagonal resize. While dragging, only the active handle stays visible.
 * - Resize is driven by window-level pointer listeners, so it cannot be
 *   stolen by the sortable drag (the handle's pointerdown stops
 *   propagation and the drag sensor is armed only by the strip) and it
 *   keeps firing even if the card re-renders or the pointer leaves it.
 *   E/W change width (size) live, N/S change height (tall) live - only
 *   `size`/`tall` change, CSS Grid reflows, order is untouched.
 * - Remove takes the tile off Home only - the widget's data is never
 *   touched, and the widget returns to the Available Widgets list.
 * - Tile content is inert while editing (pointer-events disabled) so
 *   arranging never triggers links or buttons inside a widget.
 */
export function WidgetTile({
  id,
  label,
  size,
  tall,
  allowedSizes,
  onRemove,
  onSizeChange,
  onTallChange,
  children,
}: WidgetTileProps) {
  const allowed = allowedSizes ?? WIDGET_SIZES;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const [hovered, setHovered] = useState(false);
  const [activeAxis, setActiveAxis] = useState<ResizeAxis | null>(null);
  const [activeCorner, setActiveCorner] = useState<Corner | null>(null);
  const [cornerProx, setCornerProx] = useState<Corner | null>(null);

  // Latest values/callbacks so the window drag handler never goes stale.
  const sizeRef = useRef(size);
  const allowedRef = useRef(allowed);
  const onSizeRef = useRef(onSizeChange);
  const onTallRef = useRef(onTallChange);
  useEffect(() => {
    sizeRef.current = size;
    allowedRef.current = allowed;
    onSizeRef.current = onSizeChange;
    onTallRef.current = onTallChange;
  });

  // Active pointer-drag state. Window listeners (not pointer capture) make
  // the resize reliable: it can't be lost to a re-render, hover flip, or a
  // sibling element.
  const dragRef = useRef<{
    axis: ResizeAxis;
    corner: Corner | null;
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      const current = sizeRef.current;

      // Width (size): E grows right / shrinks left; W grows left / shrinks right.
      if (d.axis === "e" || d.axis === "corner") {
        if (Math.abs(dx) >= RESIZE_STEP_PX) {
          onSizeRef.current(stepSize(current, dx > 0 ? 1 : -1, allowedRef.current));
          // Reset the anchor so continued dragging keeps stepping.
          d.lastX = e.clientX;
        }
      } else if (d.axis === "w") {
        if (Math.abs(dx) >= RESIZE_STEP_PX) {
          onSizeRef.current(stepSize(current, dx > 0 ? -1 : 1, allowedRef.current));
          d.lastX = e.clientX;
        }
      }

      // Height (tall): S grows down / shrinks up; N grows up / shrinks down.
      if (d.axis === "s" || d.axis === "corner") {
        if (Math.abs(dy) >= RESIZE_STEP_PX) {
          onTallRef.current(dy > 0);
          d.lastY = e.clientY;
        }
      } else if (d.axis === "n") {
        if (Math.abs(dy) >= RESIZE_STEP_PX) {
          onTallRef.current(dy < 0);
          d.lastY = e.clientY;
        }
      }
    }

    function onEnd(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setActiveAxis(null);
      setActiveCorner(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, []);

  function startResize(e: React.PointerEvent<HTMLButtonElement>, axis: ResizeAxis, corner: Corner | null = null) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { axis, corner, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    setActiveAxis(axis);
    setActiveCorner(corner);
    setCornerProx(null);
  }

  /** Keyboard resize - the same axis mapping as the pointer drags. */
  function onResizeKey(e: React.KeyboardEvent<HTMLButtonElement>, axis: ResizeAxis) {
    if (axis === "e" || axis === "corner") {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onSizeChange(stepSize(size, 1, allowed));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSizeChange(stepSize(size, -1, allowed));
      }
    } else if (axis === "w") {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSizeChange(stepSize(size, 1, allowed));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSizeChange(stepSize(size, -1, allowed));
      }
    }
    if (axis === "s" || axis === "corner") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onTallChange(true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onTallChange(false);
      }
    } else if (axis === "n") {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onTallChange(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onTallChange(false);
      }
    }
  }

  /** Reveals the corner handle nearest the pointer (within CORNER_REVEAL_PX). */
  function updateCornerProx(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const dist = (px: number, py: number) => Math.hypot(x - px, y - py);
    const nw = dist(0, 0);
    const ne = dist(w, 0);
    const sw = dist(0, h);
    const se = dist(w, h);
    const min = Math.min(nw, ne, sw, se);
    if (min <= CORNER_REVEAL_PX) {
      setCornerProx(min === nw ? "nw" : min === ne ? "ne" : min === sw ? "sw" : "se");
    } else {
      setCornerProx(null);
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const edgeVisible = (axis: ResizeAxis) => (hovered && !activeAxis) || activeAxis === axis;
  const cornerVisible = (c: Corner) =>
    (!activeAxis && cornerProx === c) || (activeAxis === "corner" && activeCorner === c);
  const visibility = (visible: boolean) =>
    visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none";

  /**
   * Mid-edge handles: a tiny thin grip (the VISIBLE bar) centered on each
   * edge, riding inside a LARGER invisible hitbox so grabbing is forgiving
   * while the card stays visually clean. The bar stays a 24x3 (or 3x24)
   * sliver straddling the border - like a window resize notch, not a button;
   * only the invisible pointer target is generous (48x24 / 24x48, extending
   * ~12px outside/inside the edge).
   */
  const edges: {
    axis: ResizeAxis;
    position: string;
    hitbox: string;
    bar: string;
    cursor: string;
    aria: string;
    title: string;
  }[] = [
    {
      axis: "n",
      position: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
      hitbox: "h-6 w-12",
      bar: "h-[3px] w-6",
      cursor: "cursor-ns-resize",
      aria: `Resize ${label} from top edge`,
      title: "Drag to resize (up = tall, down = normal)",
    },
    {
      axis: "e",
      position: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
      hitbox: "h-12 w-6",
      bar: "w-[3px] h-6",
      cursor: "cursor-ew-resize",
      aria: `Resize ${label} from right edge`,
      title: "Drag to resize (right = bigger, left = smaller)",
    },
    {
      axis: "s",
      position: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
      hitbox: "h-6 w-12",
      bar: "h-[3px] w-6",
      cursor: "cursor-ns-resize",
      aria: `Resize ${label} from bottom edge`,
      title: "Drag to resize (down = tall, up = normal)",
    },
    {
      axis: "w",
      position: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
      hitbox: "h-12 w-6",
      bar: "w-[3px] h-6",
      cursor: "cursor-ew-resize",
      aria: `Resize ${label} from left edge`,
      title: "Drag to resize (left = bigger, right = smaller)",
    },
  ];

  /** Diagonal handles - revealed only near the matching corner. */
  const corners: { c: Corner; position: string; cursor: string; aria: string }[] = [
    {
      c: "nw",
      position: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
      cursor: "cursor-nwse-resize",
      aria: `Resize ${label} from top-left corner`,
    },
    {
      c: "ne",
      position: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
      cursor: "cursor-nesw-resize",
      aria: `Resize ${label} from top-right corner`,
    },
    {
      c: "sw",
      position: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
      cursor: "cursor-nesw-resize",
      aria: `Resize ${label} from bottom-left corner`,
    },
    {
      c: "se",
      position: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
      cursor: "cursor-nwse-resize",
      aria: `Resize ${label} from bottom-right corner`,
    },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-tile-id={id}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setCornerProx(null);
      }}
      onPointerMove={(e) => {
        if (hovered && !activeAxis) updateCornerProx(e);
      }}
      className={`relative col-span-12 ${SPAN_CLASS[size]} ${tall ? "md:row-span-2" : ""} ${
        isDragging ? "z-20 opacity-90" : ""
      }`}
    >
      <div
        className={`h-full overflow-hidden rounded-[10px] border bg-surface ${
          isDragging ? "border-gold-token ring-1 ring-gold-token" : "border-gold-soft"
        }`}
      >
        {/* Drag handle strip - reorder only, never a saved position. */}
        <div
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label={`Move ${label}. Press Space to pick up, then use arrow keys to change its position, Space to drop.`}
          className="widget-drag-handle flex cursor-grab touch-none items-center gap-1.5 border-b border-line bg-gold-soft px-2.5 py-1.5 active:cursor-grabbing"
        >
          <IconGrip size={13} className="shrink-0 text-gold-token" />
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-token">
            {label}
          </span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove ${label} from Home`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gold-token transition hover:bg-surface hover:text-warn"
          >
            <IconX size={12} />
          </button>
        </div>
        {/* Content is inert while arranging - no accidental navigation. */}
        <div className="pointer-events-none min-h-0 select-none p-5">{children}</div>

        {/* Size hint while editing, so the current span is obvious. */}
        <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full border border-line bg-surface px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">
          {SIZE_COLUMNS[size]} cols{tall ? " · tall" : ""}
        </span>
      </div>

      {/* Mid-edge resize handles - siblings of the card so they can straddle
          its edges (the card clips its own content with overflow-hidden).
          Shown on hover; the active handle stays visible during its drag. */}
      {edges.map((h) => (
        <button
          key={h.axis}
          type="button"
          onPointerDown={(e) => startResize(e, h.axis)}
          onKeyDown={(e) => onResizeKey(e, h.axis)}
          aria-label={h.aria}
          title={h.title}
          tabIndex={edgeVisible(h.axis) ? 0 : -1}
          className={`group absolute z-10 flex touch-none items-center justify-center rounded-full ${h.position} ${h.hitbox} ${h.cursor} ${visibility(
            edgeVisible(h.axis)
          )}`}
        >
          {/* The tiny visible grip - the button itself is an invisible hitbox.
              Small by size (24x3 / 3x24), not by opacity, so it stays traceable
              on both Midnight and Rose. */}
          <span
            className={`block rounded-full bg-gold-token opacity-80 transition-opacity group-hover:opacity-100 ${h.bar}`}
          />
        </button>
      ))}

      {/* Diagonal corner handles - hidden unless the pointer is directly on
          that corner (or that corner is being dragged). */}
      {corners.map((c) => (
        <button
          key={c.c}
          type="button"
          onPointerDown={(e) => startResize(e, "corner", c.c)}
          onKeyDown={(e) => onResizeKey(e, "corner")}
          aria-label={c.aria}
          title="Drag to resize both dimensions"
          tabIndex={cornerVisible(c.c) ? 0 : -1}
          className={`absolute z-10 flex h-5 w-5 touch-none items-center justify-center rounded-md border border-line bg-surface text-gold-token shadow-sm transition-opacity hover:border-gold-soft hover:bg-gold-soft ${c.position} ${c.cursor} ${visibility(
            cornerVisible(c.c)
          )}`}
        >
          <IconResizeCorner size={11} />
        </button>
      ))}
    </div>
  );
}
