"use client";

import { useEffect, useState } from "react";

type ThemeId = "dark" | "pink";

const THEMES: Array<{
  id: ThemeId;
  name: string;
  swatches: string[];
}> = [
  {
    id: "dark",
    name: "Midnight",
    swatches: ["#0f0f11", "#17181b", "#7f8995", "#9ea7b3"],
  },
  {
    id: "pink",
    name: "Rose",
    swatches: ["#eeeeF0", "#f6e8e7", "#ead0d1", "#d9bbbd"],
  },
];

/**
 * Theme chooser for the whole app. Replaces the old dark/light toggle: pick
 * Midnight (the current dark palette) or Rose (the soft pink palette), stored
 * in localStorage as hc-theme and applied on the <html> element by the
 * layout script before first paint.
 */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("pink") ? "pink" : "dark");
  }, []);

  function choose(id: ThemeId) {
    setTheme(id);
    document.documentElement.classList.toggle("dark", id === "dark");
    document.documentElement.classList.toggle("pink", id === "pink");
    window.localStorage.setItem("hc-theme", id);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-pressed={active}
            className={`rounded-[10px] border p-4 text-left transition ${
              active ? "border-gold bg-gold/10" : "border-base bg-[var(--surface-strong)] hover:border-sealion"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-[13.5px] font-bold text-navy">{t.name}</p>
            {active && (
              <span className="rounded-full bg-gold px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-on-accent">
                Active
              </span>
            )}
          </div>
            <div className="mt-3 flex items-center gap-1.5">
              {t.swatches.map((c) => (
                <span
                  key={c}
                  className="h-4 w-4 rounded-full border border-base"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
