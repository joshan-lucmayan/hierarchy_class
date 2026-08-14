"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("hc-theme", next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        isDark ? "border-line bg-gold" : "border-line bg-[var(--line)]"
      }`}
    >
      {/* top-1/2 + -translate-y-1/2 keeps the knob dead-center vertically;
          left offsets pin it to the track ends horizontally. */}
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-navy transition-all ${
          isDark ? "left-[24px]" : "left-[4px]"
        }`}
      />
    </button>
  );
}
