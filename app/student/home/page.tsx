import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { FeedPost } from "@/components/feed/FeedPost";
import { FriendsStories } from "@/components/feed/FriendsStories";
import { CURRENT_STUDENT } from "@/data/mockStudents";
import { SCHOOL_POSTS } from "@/data/schoolFeed";

const STAT_META = [
  { key: "academic" as const, label: "Academic", color: "#378ADD" },
  { key: "physical" as const, label: "Physical", color: "#E24B4A" },
];

export default function StudentHomePage() {
  const student = CURRENT_STUDENT;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
      <section className="space-y-4">
        <FriendsStories />

        <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Latest School Feed</h1>

        <div className="space-y-4">
          {SCHOOL_POSTS.map((post) => (
            <FeedPost key={post.id} post={post} />
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
          <div className="flex flex-col items-center text-center">
            <p className="text-xs text-muted">Grade {student.gradeLevel} · {student.section} · {student.quarter}</p>

            <div className="mt-5">
              <RankBadge rank={student.overallRank} size="lg" />
            </div>

            <div className="mt-3">
              <svg width="140" height="60" viewBox="0 0 140 60" fill="none">
                <path
                  d="M14 10 L70 50 L126 10"
                  stroke="var(--surface-strong)"
                  strokeWidth="15"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                />
                <path
                  d="M14 10 L70 50 L126 10"
                  stroke="#c9962c"
                  strokeWidth="15"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  strokeDasharray={138}
                  strokeDashoffset={138 * (1 - student.academicExcellence / 100)}
                />
              </svg>
            </div>
            <div className="mt-1 flex flex-col items-center">
              <p className="text-lg font-bold text-navy">
                {student.academicExcellence}<span className="text-xs font-semibold text-muted">/100</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Academic Excellence</p>
            </div>
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Stat Snapshot</h2>
          <div className="mt-4 space-y-3">
            {STAT_META.map((stat) => (
              <div key={stat.key} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stat.color }} />
                <span className="w-20 text-xs font-semibold text-muted">{stat.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${student.stats[stat.key]}%`, backgroundColor: stat.color }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-navy">{student.stats[stat.key]}</span>
              </div>
            ))}
          </div>
        </CornerFrame>
      </aside>
    </div>
  );
}
