"use client";

import { useEffect, useMemo, useState } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useRankStore } from "@/lib/rankStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import type { Rank } from "@/lib/rankEngine";

interface SeasonLog {
  student_id: string;
  season_id: string;
  school_year: string;
  semester_label: string;
  grade_level: string;
  strand_or_track: string | null;
  section: string | null;
  peak_rank: Rank;
  final_rank_before_reset: Rank;
  reset_to_rank: Rank;
  ex_achieved: boolean;
  season_end_date: string;
  full_name: string;
}

export default function AdminRanksPage() {
  const { profile } = useMyProfile();
  const { profiles: students, loading: studentsLoading } = useSchoolProfiles({ role: "student" });
  const { sorted, rankOf, loading: ranksLoading, error: ranksError } = useRankStore();

  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [semesterLabel, setSemesterLabel] = useState("First Semester");
  const [semStartDate, setSemStartDate] = useState("");
  const [semEndDate, setSemEndDate] = useState("");
  const [activeSemester, setActiveSemester] = useState<any | null>(null);
  const [semDeclaring, setSemDeclaring] = useState(false);
  const [semMessage, setSemMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [seasonEnding, setSeasonEnding] = useState(false);
  const [seasonMessage, setSeasonMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [seasonLogs, setSeasonLogs] = useState<SeasonLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // School standings: students with rank state sorted best-first, then the rest.
  const standings = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    const ranked = sorted
      .filter((r) => byId.has(r.student_id))
      .map((r) => ({ student: byId.get(r.student_id)!, rank: r }));
    const unranked = students
      .filter((s) => !rankOf(s.id))
      .map((s) => ({ student: s, rank: null }))
      .sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
    return [...ranked, ...unranked];
  }, [students, sorted, rankOf]);

  // Season history for the school (migration 035).
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const supabase = createClient();
    (supabase as any)
      .rpc("get_school_season_history", { p_school_id: profile.school_id })
      .then(({ data, error: rpcError }: any) => {
        if (cancelled) return;
        if (!rpcError) setSeasonLogs((data ?? []) as SeasonLog[]);
        setLogsLoading(false);
      });
    (supabase as any)
      .rpc("get_active_semester", { p_school_id: profile.school_id })
      .then(({ data }: any) => {
        if (cancelled) return;
        setActiveSemester(data ?? null);
        if (data) {
          setSchoolYear(data.school_year ?? "2026-2027");
          setSemesterLabel(data.semester_label ?? "First Semester");
          setSemStartDate(data.start_date ?? "");
          setSemEndDate(data.end_date ?? "");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  async function declareSemester() {
    if (!profile) return;
    if (!schoolYear.trim() || !semesterLabel.trim()) {
      setSemMessage({ kind: "err", text: "School year and semester label are required." });
      return;
    }
    setSemDeclaring(true);
    setSemMessage(null);
    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc("declare_semester", {
      p_school_id: profile.school_id,
      p_school_year: schoolYear.trim(),
      p_semester_label: semesterLabel.trim(),
      p_start_date: semStartDate || null,
      p_end_date: semEndDate || null,
    });
    setSemDeclaring(false);
    if (error) {
      setSemMessage({ kind: "err", text: `Couldn't declare the semester: ${error.message}` });
      return;
    }
    setActiveSemester(data);
    setSemMessage({ kind: "ok", text: `Semester "${data?.semester_label}" (${data?.school_year}) is now active.` });
  }

  async function endSeason() {
    if (!profile) return;
    if (
      !window.confirm(
        `End "${semesterLabel}" (${schoolYear})?\n\nEvery student's rank is reseeded from their season PEAK rank (EX/S/S+/S++ -> C, A/B/C/D -> D), season history is recorded, and next season starts fresh. This cannot be undone.`
      )
    ) {
      return;
    }
    setSeasonEnding(true);
    setSeasonMessage(null);
    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc("end_season_for_school", {
      p_school_id: profile.school_id,
      p_school_year: schoolYear,
      p_semester_label: semesterLabel,
    });
    setSeasonEnding(false);
    if (error) {
      setSeasonMessage({ kind: "err", text: `Couldn't end the season: ${error.message}` });
      return;
    }
    setSeasonMessage({
      kind: "ok",
      text: `Season "${data?.season_id}" ended - reseeded ${data?.ended ?? 0} student(s).`,
    });
    // Refresh season history.
    const { data: logs } = await (supabase as any).rpc("get_school_season_history", {
      p_school_id: profile.school_id,
    });
    if (logs) setSeasonLogs(logs as SeasonLog[]);
  }

  const loading = studentsLoading || ranksLoading;

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Rank overview</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">School rank standings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Live standings from the non-linear rank engine. The season ends when the semester is over -
          run the end-season action below to reseed everyone from their season peak.
        </p>
      </CornerFrame>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Standings */}
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Standings</h2>
          {loading && <p className="mt-4 text-sm text-muted">Loading standings...</p>}
          {ranksError && <p className="mt-4 text-sm text-red-500">{ranksError}</p>}
          {!loading && !ranksError && standings.length === 0 && (
            <p className="mt-4 text-sm text-muted">No students yet.</p>
          )}
          <div className="mt-4 space-y-3">
            {standings.map(({ student, rank }, idx) => (
              <div key={student.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] px-3.5 py-2.5">
                <span className="w-6 text-center text-xs font-bold text-muted">{rank ? idx + 1 : "-"}</span>
                <UserAvatar name={student.full_name} src={student.avatar_url} size="md" profileId={student.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {[student.educational_level, student.program, student.level_label].filter(Boolean).join(" · ") || "No level set"}
                  </p>
                </div>
                {rank ? (
                  <div className="flex flex-col items-end">
                    <RankBadge rank={rank.current_rank} size="sm" />
                    <span className="mt-1 text-[11px] text-muted">
                      {rank.current_rank === "EX" ? `EX ${rank.ex_score}` : `bar ${Math.round(rank.current_bar)}`}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted">No rank yet</span>
                )}
              </div>
            ))}
          </div>
        </CornerFrame>

        {/* Season control + history */}
        <div className="space-y-6">
          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Declare semester</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {activeSemester
                ? `Active: ${activeSemester.semester_label} · ${activeSemester.school_year}${activeSemester.start_date ? ` · from ${activeSemester.start_date}` : ""}${activeSemester.end_date ? ` · to ${activeSemester.end_date}` : ""}`
                : "No active semester yet - declaring one sets the grading period every approved grade feeds into."}
            </p>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">School year</label>
                  <input
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(e.target.value)}
                    className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">Semester label</label>
                  <input
                    value={semesterLabel}
                    onChange={(e) => setSemesterLabel(e.target.value)}
                    className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">Start date</label>
                  <input
                    type="date"
                    value={semStartDate}
                    onChange={(e) => setSemStartDate(e.target.value)}
                    className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">End date</label>
                  <input
                    type="date"
                    value={semEndDate}
                    onChange={(e) => setSemEndDate(e.target.value)}
                    className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={declareSemester}
                disabled={semDeclaring}
                className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
              >
                {semDeclaring ? "Declaring..." : activeSemester ? "Update semester" : "Declare semester"}
              </button>
              {semMessage && (
                <p className={`text-sm ${semMessage.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                  {semMessage.text}
                </p>
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">End season</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Runs when the first semester is over. Reseeds every student from their season peak and logs
              season history.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted">School year</label>
                <input
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted">Semester</label>
                <input
                  value={semesterLabel}
                  onChange={(e) => setSemesterLabel(e.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
              <button
                type="button"
                onClick={endSeason}
                disabled={seasonEnding}
                className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
              >
                {seasonEnding ? "Ending season..." : "End season & reseed"}
              </button>
              {seasonMessage && (
                <p className={`text-sm ${seasonMessage.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                  {seasonMessage.text}
                </p>
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Season history</h2>
            {logsLoading ? (
              <p className="mt-4 text-sm text-muted">Loading...</p>
            ) : seasonLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No seasons recorded yet.</p>
            ) : (
              <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                {seasonLogs.map((log, i) => (
                  <div key={`${log.student_id}-${log.season_id}-${i}`} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-navy">{log.full_name}</p>
                      <RankBadge rank={log.peak_rank} size="sm" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {log.school_year} · {log.semester_label} -&gt; reset to {log.reset_to_rank}
                      {log.ex_achieved ? " · EX achieved" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>
        </div>
      </div>
    </div>
  );
}
