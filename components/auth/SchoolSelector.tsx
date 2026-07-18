"use client";

import { useMemo, useRef, useState } from "react";
import { School } from "@/types/school";

interface SchoolSelectorProps {
  schools: School[];
  value: School | null;
  onChange: (school: School) => void;
  error?: string;
}

const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

function Crest({ abbr }: { abbr: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-navy text-[9px] font-bold text-gold"
      style={{ clipPath: HEX_CLIP }}
    >
      {abbr}
    </span>
  );
}

export function SchoolSelector({ schools, value, onChange, error }: SchoolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return schools;
    const q = query.toLowerCase();
    return schools.filter(
      (s) => s.name.toLowerCase().includes(q) || s.abbreviation.toLowerCase().includes(q)
    );
  }, [schools, query]);

  function handleSelect(school: School) {
    onChange(school);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-xs font-semibold uppercase tracking-wider text-navy">
        Choose your school
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors
            ${error ? "border-red-400" : "border-base"}
            ${isOpen ? "border-navy ring-1 ring-gold" : "hover:border-base"}`}
        >
          {value ? (
            <span className="flex items-center gap-2.5">
              <Crest abbr={value.abbreviation} />
              <span className="text-navy">{value.name}</span>
            </span>
          ) : (
            <span className="text-gray-400">Select your institution</span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-lg border border-base bg-surface shadow-lg">
            <div className="border-b border-base p-2">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search schools..."
                className="w-full rounded-md border border-base px-3 py-2 text-sm outline-none focus:border-navy"
              />
            </div>

            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <li className="px-3.5 py-3 text-sm text-gray-400">No schools found</li>
              )}
              {filtered.map((school) => {
                const isSelected = value?.id === school.id;
                return (
                  <li key={school.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(school)}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-gray-50
                        ${isSelected ? "bg-gray-50" : ""}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Crest abbr={school.abbreviation} />
                        <span className="text-navy">{school.name}</span>
                      </span>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gold">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
