"use client";

import { useEffect, useMemo, useState } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useRankStore } from "@/lib/rankStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { RankTriangle } from "@/components/ui/RankTriangle";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconUser, IconCheck, IconCalendar } from "@/components/ui/icons";
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

/**
 * The rank ladder identity - the same token set the landing page ladder and
 * RankDistribution use (bg-rank-* / text-rankText-* / border-rankBorder-*),
 * so the ladder reads as Hierarchy Class, not eight generic KPI tiles.
 */
const LADDER: { letter: Rank; note: string }[] = [
  { letter: "D", note: "Fresh start" },
  { letter: "C", note: "Building" },
  { letter: "B", note: "Consistent" },
  { letter: "A", note: "Strong" },
  { letter: "S", note: "Elite" },
  { letter: "S+", note: "Exceptional" },
  { letter: "S++", note: "Near perfect" },
  { letter: "EX", note: "Extra" },
];

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
  const [confirmEnd, setConfirmEnd] = useState(false);

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

  const exCount = useMemo(
    () => standings.filter((s) => s.rank?.current_rank === "EX").length,
    [standings]
  );

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

  function requestEndSeason() {
    if (!profile) return;
    setConfirmEnd(true);
  }

  async function runEndSeason() {
    if (!profile) return;
    setConfirmEnd(false);
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

  const inputCls =
    "mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold";

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Rank system</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            School rank standings · {students.length} students
          </h2>
        </div>
        <Stat
          label="EX students"
          value={exCount}
          tone={exCount > 0 ? "gold" : "muted"}
          hint="Extra this season"
        />
      </div>

      {ranksError && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{ranksError}</p>
      )}

      {/* ============================================================ */}
      {/* BAND 1 - THE LADDER (hero)                                  */}
      {/* ============================================================ */}
      <CornerFrame tone="gold" className="p-5">
        <h3 className="section-label">The ladder</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
          Eight ranks, one climb. Every season starts fresh - S and above land in C, A and below land in D.
          Promotion happens when a bar fills; EX belongs to Extra seasons.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {LADDER.map((tier) => (
            <div
              key={tier.letter}
              className="flex flex-col items-center gap-2 rounded-[10px] border border-base bg-tile px-1 py-3"
            >
              <RankTriangle rank={tier.letter} size="lg" />
              <span className="text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
                {tier.note}
              </span>
            </div>
          ))}
        </div>
      </CornerFrame>

      {/* ============================================================ */}
      {/* BAND 2 - STANDINGS + SEASON CONTROL                        */}
      {/* ============================================================ */}
      {loading ? (
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <CornerFrame className="p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-tile" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded-full bg-tile" />
                    <div className="h-2.5 w-24 rounded-full bg-tile" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          </CornerFrame>
          <div className="space-y-4">
            <CornerFrame className="p-5">
              <div className="h-3 w-32 animate-pulse rounded-full bg-tile" />
              <div className="mt-4 h-28 animate-pulse rounded-[10px] bg-tile" />
            </CornerFrame>
            <CornerFrame className="p-5">
              <div className="h-3 w-24 animate-pulse rounded-full bg-tile" />
              <div className="mt-4 h-20 animate-pulse rounded-[10px] bg-tile" />
            </CornerFrame>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          {/* Standings */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Standings</h3>
            <div className="mt-3 space-y-1.5">
              {standings.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={<IconUser size={16} />}
                    title="No students yet"
                    desc="Students appear here as soon as they sign up and start earning grades."
                  />
                </div>
              ) : (
                standings.map(({ student, rank }, idx) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] px-3.5 py-2.5"
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-muted">{rank ? idx + 1 : "-"}</span>
                    <UserAvatar name={student.full_name} src={student.avatar_url} size="md" profileId={student.id} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {[student.educational_level, student.program, student.level_label].filter(Boolean).join(" · ") || "No level set"}
                      </p>
                    </div>
                    {rank ? (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <RankBadge rank={rank.current_rank} size="sm" />
                        <span className="text-[11px] text-muted">
                          {rank.current_rank === "EX" ? `EX ${rank.ex_score}` : `bar ${Math.round(rank.current_bar)}`}
                        </span>
                      </div>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted">No rank yet</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </CornerFrame>

          {/* Season control + history */}
          <div className="space-y-4">
            <CornerFrame className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="section-label">Declare semester</h3>
                {activeSemester && <Chip variant="success">Active</Chip>}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                {activeSemester
                  ? `Active: ${activeSemester.semester_label} · ${activeSemester.school_year}${activeSemester.start_date ? ` · from ${activeSemester.start_date}` : ""}${activeSemester.end_date ? ` · to ${activeSemester.end_date}` : ""}`
                  : "No active semester yet - declaring one sets the grading period every approved grade feeds into."}
              </p>
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">School year</label>
                    <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Semester label</label>
                    <input value={semesterLabel} onChange={(e) => setSemesterLabel(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Start date</label>
                    <input type="date" value={semStartDate} onChange={(e) => setSemStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">End date</label>
                    <input type="date" value={semEndDate} onChange={(e) => setSemEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="gold"
                  className="w-full justify-center"
                  icon={<IconCheck size={14} />}
                  disabled={semDeclaring}
                  onClick={declareSemester}
                >
                  {semDeclaring ? "Declaring..." : activeSemester ? "Update semester" : "Declare semester"}
                </Button>
                {semMessage && (
                  <p className={`text-sm ${semMessage.kind === "ok" ? "text-gold-token" : "text-warn"}`}>
                    {semMessage.text}
                  </p>
                )}
              </div>
            </CornerFrame>

            <CornerFrame className="p-5">
              <h3 className="section-label">End season</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Runs when the semester is over. Reseeds every student from their season peak and logs season history.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">School year</label>
                  <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted">Semester</label>
                  <input value={semesterLabel} onChange={(e) => setSemesterLabel(e.target.value)} className={inputCls} />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full justify-center"
                  disabled={seasonEnding}
                  onClick={requestEndSeason}
                >
                  {seasonEnding ? "Ending season..." : "End season & reseed"}
                </Button>
                {seasonMessage && (
                  <p className={`text-sm ${seasonMessage.kind === "ok" ? "text-gold-token" : "text-warn"}`}>
                    {seasonMessage.text}
                  </p>
                )}
              </div>
            </CornerFrame>

            <CornerFrame className="p-5">
              <h3 className="section-label">Season history</h3>
              {logsLoading ? (
                <div className="mt-3 space-y-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-[10px] border border-base bg-tile" />
                  ))}
                </div>
              ) : seasonLogs.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    icon={<IconCalendar size={16} />}
                    title="No seasons recorded"
                    desc="Once a season ends, every student's peak, final, and reset rank are recorded here."
                  />
                </div>
              ) : (
                <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {seasonLogs.map((log, i) => (
                    <div
                      key={`${log.student_id}-${log.season_id}-${i}`}
                      className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-navy">{log.full_name}</p>
                        <RankBadge rank={log.peak_rank} size="sm" />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {log.school_year} · {log.semester_label}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                          final {log.final_rank_before_reset} → reset {log.reset_to_rank}
                        </p>
                        {log.ex_achieved && <Chip variant="gold">EX achieved</Chip>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CornerFrame>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* END-SEASON CONFIRMATION (destructive)                       */}
      {/* ============================================================ */}
      {confirmEnd && (
        <Modal
          eyebrow="End season"
          description="This action takes effect immediately and cannot be undone."
          onClose={() => setConfirmEnd(false)}
        >
          <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <p>
              Ending <span className="font-semibold text-navy">{semesterLabel}</span> (
              <span className="font-semibold text-navy">{schoolYear}</span>) reseeds every student&apos;s rank from their
              season peak:
            </p>
            <p className="rounded-[10px] border border-base bg-tile px-3 py-2 font-mono-ui text-[11px] uppercase tracking-[0.12em] text-navy">
              EX / S / S+ / S++ → C&nbsp;&nbsp;·&nbsp;&nbsp;A / B / C / D → D
            </p>
            <p>
              Season history is recorded for each student, their peak and final rank are saved, and the next season
              starts fresh. This affects every student at the school.
            </p>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmEnd(false)} disabled={seasonEnding}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runEndSeason} disabled={seasonEnding}>
              {seasonEnding ? "Ending..." : "End season & reseed"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
