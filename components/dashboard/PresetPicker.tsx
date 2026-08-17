"use client";

import { Button } from "@/components/ui/Button";
import { PresetCard } from "@/components/dashboard/PresetCard";
import { PresetPreview } from "@/components/dashboard/PresetPreview";
import type { DashboardPreset } from "@/lib/dashboardShared";

/**
 * Preset picker for the dashboard customizers (Teacher Home and Admin Home).
 * Rendered inside the shared Modal as a responsive grid of VISUAL preset
 * cards - each card leads with a miniature dashboard preview generated from
 * that preset's real widget layout, so the user can choose by looking at
 * the arrangement instead of reading descriptions. A dedicated blank
 * "Customize yourself" card starts from an empty Home.
 *
 * Selecting a preset only loads it into the DRAFT - nothing is persisted
 * until the user hits Save, and Cancel still discards the session.
 */
export function PresetPicker({
  presets,
  currentCount,
  labelOf,
  onApply,
  onKeepCurrent,
}: {
  presets: DashboardPreset[];
  currentCount: number;
  /** Resolves a widget id to its display label (teacher/admin registry). */
  labelOf: (id: string) => string | undefined;
  onApply: (preset: DashboardPreset) => void;
  onKeepCurrent: () => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs leading-5 text-muted">
        Choose a preset to preview how your Home will look, or start from a blank dashboard. A preset loads as a draft
        you can rearrange, resize, add to, and remove from before saving.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Customize yourself - the empty-dashboard option */}
        <div className="flex flex-col rounded-[10px] border border-base bg-surface p-3 transition hover:-translate-y-0.5 hover-border-gold-soft">
          <PresetPreview widgets={[]} labelOf={labelOf} blank />
          <p className="mt-3 text-[13px] font-semibold text-navy">Customize yourself</p>
          <p className="mt-0.5 flex-1 text-[11px] leading-4 text-muted">
            Start with an empty Home and build it yourself.
            {currentCount > 0
              ? ` Your current draft (${currentCount} widget${currentCount === 1 ? "" : "s"}) is kept until you save.`
              : ""}
          </p>
          <Button variant="outline" size="sm" onClick={onKeepCurrent} className="mt-3 w-full">
            Start blank
          </Button>
        </div>

        {presets.map((preset) => (
          <PresetCard key={preset.id} preset={preset} labelOf={labelOf} onApply={onApply} />
        ))}
      </div>
    </div>
  );
}
