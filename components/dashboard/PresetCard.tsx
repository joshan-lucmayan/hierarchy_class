"use client";

import { Button } from "@/components/ui/Button";
import { PresetPreview } from "@/components/dashboard/PresetPreview";
import type { DashboardPreset } from "@/lib/dashboardShared";

/**
 * One preset option inside the dashboard customizer's preset picker: the
 * visual mini-dashboard preview is the primary element, with the preset
 * name, purpose, and the apply action below it. Hovering elevates the card
 * and emphasizes its preview border. Selecting a preset only loads it into
 * the draft - nothing is persisted until Save.
 */
export function PresetCard({
  preset,
  labelOf,
  onApply,
}: {
  preset: DashboardPreset;
  labelOf: (id: string) => string | undefined;
  onApply: (preset: DashboardPreset) => void;
}) {
  return (
    <div className="flex flex-col rounded-[10px] border border-base bg-surface p-3 transition hover:-translate-y-0.5 hover-border-accent-soft">
      <PresetPreview widgets={preset.widgets} labelOf={labelOf} />
      <p className="mt-3 text-[13px] font-semibold text-navy">{preset.label}</p>
      <p className="mt-0.5 flex-1 text-[11px] leading-4 text-muted">{preset.description}</p>
      <Button variant="outline" size="sm" onClick={() => onApply(preset)} className="mt-3 w-full">
        Apply preset
      </Button>
    </div>
  );
}
