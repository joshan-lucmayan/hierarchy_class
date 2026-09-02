"use client";

import { useState } from "react";
import {
  HABIT_CATEGORIES,
  HABIT_CATEGORY_LABELS,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  type Habit,
  type HabitInput,
} from "@/lib/habitStore";
import { DAY_SHORT } from "@/components/habits/habitFormat";

const UNIT_HINTS: Record<string, string> = {
  completion: "times",
  count: "times",
  duration: "minutes",
  quantity: "pages",
};

/**
 * Create / edit habit form. Validation is enforced here AND at the database
 * level (target > 0, at least one scheduled day, unique name per student).
 * Editing never rewrites historical entries - it only updates the habit
 * definition, so past records stay historically accurate.
 */
export function HabitFormModal({
  habit,
  onSave,
  onClose,
}: {
  habit?: Habit;
  onSave: (input: HabitInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [category, setCategory] = useState(habit?.category ?? "study");
  const [goalType, setGoalType] = useState(habit?.goalType ?? "completion");
  const [targetValue, setTargetValue] = useState(String(habit?.targetValue ?? ""));
  const [targetUnit, setTargetUnit] = useState(habit?.targetUnit ?? UNIT_HINTS[habit?.goalType ?? "completion"] ?? "");
  const [frequency, setFrequency] = useState(habit?.frequencyType ?? "weekly");
  const [days, setDays] = useState<number[]>(habit?.scheduledDays ?? [0, 1, 2, 3, 4]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleDay(i: number) {
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]));
  }

  function changeGoalType(type: HabitInput["goalType"]) {
    setGoalType(type);
    setTargetUnit(UNIT_HINTS[type] ?? "");
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Give your habit a name.";
    const value = Number(targetValue);
    if (!targetValue || Number.isNaN(value) || value <= 0) {
      next.targetValue = "Target must be a number above 0.";
    }
    if (days.length === 0) next.days = "Pick at least one scheduled day.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    const err = await onSave({
      id: habit?.id,
      name,
      description: description || null,
      category,
      icon: category,
      goalType,
      targetValue: Number(targetValue),
      targetUnit: targetUnit || null,
      frequencyType: frequency,
      scheduledDays: [...days].sort((a, b) => a - b),
    });
    setSaving(false);
    if (err) {
      setSaveError(err);
      return;
    }
    onClose();
  }

  const fieldClass =
    "w-full rounded-[8px] border border-line bg-tile px-3 py-2 text-sm text-navy outline-none transition focus:border-sealion";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!saving) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[10px] border border-base bg-surface p-6"
        style={{ maxHeight: "min(90vh, 90dvh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 h-1 w-10 rounded-full bg-accent" />
        <h2 className="mt-2 text-lg font-bold text-navy">{habit ? "Edit habit" : "Create habit"}</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          {habit
            ? "Changing the definition never rewrites past records - history stays accurate."
            : "Start small and stay consistent. You can adjust this any time."}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-name">
              Name
            </label>
            <input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Study Java"
              maxLength={60}
              className={fieldClass}
            />
            {errors.name && <p className="mt-1 text-xs text-warn">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-desc">
              Description
            </label>
            <textarea
              id="habit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional - what does this habit look like?"
              rows={2}
              maxLength={160}
              className={`${fieldClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-category">
                Category
              </label>
              <select
                id="habit-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as HabitInput["category"]);
                }}
                className={fieldClass}
              >
                {HABIT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {HABIT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-goal">
                Goal
              </label>
              <select
                id="habit-goal"
                value={goalType}
                onChange={(e) => changeGoalType(e.target.value as HabitInput["goalType"])}
                className={fieldClass}
              >
                {GOAL_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {GOAL_TYPE_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-target">
                Target
              </label>
              <input
                id="habit-target"
                type="number"
                min={1}
                step="any"
                inputMode="decimal"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="5"
                className={fieldClass}
              />
              {errors.targetValue && <p className="mt-1 text-xs text-warn">{errors.targetValue}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint" htmlFor="habit-unit">
                Unit
              </label>
              <input
                id="habit-unit"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                placeholder="times"
                maxLength={20}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["weekly", "daily"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  aria-pressed={frequency === f}
                  className={`rounded-[8px] border px-3 py-2 text-left text-sm transition ${
                    frequency === f
                      ? "border-sealion bg-accent/10 text-navy"
                      : "border-line bg-tile text-muted hover:border-sealion"
                  }`}
                >
                  <span className="block font-semibold">{f === "weekly" ? "Per week" : "Per day"}</span>
                  <span className="block text-[11px] text-faint">
                    {f === "weekly"
                      ? "Progress counts across the week"
                      : "Each scheduled day must hit the target"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
              Scheduled days
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_SHORT.map((label, i) => {
                const active = days.includes(i);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={active}
                    aria-label={`${label} - ${active ? "scheduled" : "not scheduled"}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-semibold transition ${
                      active
                        ? "border-sealion bg-accent text-on-accent"
                        : "border-line bg-tile text-faint hover:border-sealion"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {errors.days && <p className="mt-1 text-xs text-warn">{errors.days}</p>}
          </div>

          {saveError && (
            <p className="rounded-lg border border-warn-soft bg-warn-soft px-3 py-2 text-xs font-medium text-warn">
              {saveError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover-bg-accent-token hover-text-on-accent disabled:opacity-60"
            >
              {saving ? "Saving..." : habit ? "Save changes" : "Create habit"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-sealion hover:text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
