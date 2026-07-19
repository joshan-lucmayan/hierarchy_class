import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { FeedPost } from "@/components/feed/FeedPost";
import { FriendsStories } from "@/components/feed/FriendsStories";
import { CURRENT_STUDENT, ANNOUNCEMENTS } from "@/data/mockStudents";
import { SCHOOL_POSTS } from "@/data/schoolFeed";

const STAT_META = [
  { key: "academic" as const, label: "Academic", color: "#378ADD" },
  { key: "physical" as const, label: "Physical", color: "#E24B4A" },
  { key: "charisma" as const, label: "Charisma", color: "#EF9F27" },
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-navy text-lg font-bold text-gold">
              {student.initials}
            </div>
            <p className="mt-3 text-base font-bold text-navy">{student.name}</p>
            <p className="mt-1 text-xs text-muted">Grade {student.gradeLevel} · {student.section}</p>
            <div className="mt-4">
              <RankBadge rank={student.overallRank} size="lg" />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted">Academic Excellence</span>
              <span className="font-semibold text-navy">{student.academicExcellence}/100</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${student.academicExcellence}%` }}
              />
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

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Announcements/Updates</h2>
          <div className="mt-4 space-y-3">
            {ANNOUNCEMENTS.map((a) => (
              <div key={a.id} className="rounded-2xl border border-base p-3 transition hover:border-gold">
                <p className="text-sm font-semibold text-navy">{a.title}</p>
                <p className="mt-1 text-xs text-muted">{a.body}</p>
              </div>
            ))}
          </div>
        </CornerFrame>
      </aside>
    </div>
  );
}
