import { RankBadge } from "@/components/ui/RankBadge";
import { CURRENT_STUDENT, ANNOUNCEMENTS } from "@/data/mockStudents";

export default function StudentHomePage() {
  const student = CURRENT_STUDENT;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-100 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Welcome back</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">{student.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Keep climbing the ranks with assignments, badges, and progress updates from your teachers.
          </p>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current rank</p>
              <p className="mt-1 text-3xl font-bold text-navy">{student.academicExcellence}<span className="ml-2 text-sm font-medium text-slate-500">/ 100</span></p>
            </div>
            <RankBadge rank={student.overallRank} size="lg" />
          </div>
          <p className="mt-4 text-sm text-slate-600">Grade {student.gradeLevel} · {student.section}</p>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-gray-100 bg-white p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-navy">Announcements</h2>
          <div className="mt-4 space-y-3">
            {ANNOUNCEMENTS.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-navy">{a.title}</p>
                <p className="mt-1 text-xs text-slate-500">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
