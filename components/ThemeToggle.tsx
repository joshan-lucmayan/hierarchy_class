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
      className={`h-6 w-11 shrink-0 rounded-full transition ${isDark ? "bg-gold" : "bg-[var(--surface-strong)]"}`}
    >
      <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${isDark ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
