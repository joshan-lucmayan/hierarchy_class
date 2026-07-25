"use client";

import { useState } from "react";
import { MOCK_SCHOOLS } from "@/data/schools";
import { CornerFrame } from "@/components/ui/CornerFrame";

const SCHOOL_STATS: Record<string, { students: number; teachers: number; status: "active" | "pending" }> = {
  csa: { students: 842, teachers: 46, status: "active" },
  svs: { students: 510, teachers: 29, status: "active" },
  hna: { students: 375, teachers: 22, status: "active" },
  gis: { students: 198, teachers: 14, status: "pending" },
  mvs: { students: 263, teachers: 17, status: "active" },
};

export default function AdminSchoolsPage() {
  const [query, setQuery] = useState("");

  const schools = MOCK_SCHOOLS.filter((school) =>
    school.name.toLowerCase().includes(query.toLowerCase()) || school.abbreviation.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Schools</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Tenant management</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Add or remove schools, and view registration status for each campus.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools..."
            className="w-full max-w-md rounded-3xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy placeholder:text-muted outline-none"
          />
        </div>
      </CornerFrame>

      <section className="grid gap-4 xl:grid-cols-2">
        {schools.map((school) => {
          const stats = SCHOOL_STATS[school.id] ?? { students: 0, teachers: 0, status: "pending" as const };
          return (
            <CornerFrame
              key={school.id}
              className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-gold bg-navy text-sm font-bold text-gold">
                    {school.abbreviation}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{school.name}</p>
                    <p className="text-xs text-muted">ID: {school.id}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    stats.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-gold/20 text-gold"
                  }`}
                >
                  {stats.status === "active" ? "Active" : "Pending review"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
                  <p className="text-2xl font-bold text-navy">{stats.students}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted">Students</p>
                </div>
                <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
                  <p className="text-2xl font-bold text-navy">{stats.teachers}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted">Teachers</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                >
                  Manage
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </CornerFrame>
          );
        })}
      </section>
    </div>
  );
}
