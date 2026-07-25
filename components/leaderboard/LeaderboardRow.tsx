import { RankBadge } from "@/components/ui/RankBadge";
import { LeaderboardEntry } from "@/types/student";

export function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser?: boolean }) {
  const { rank, student } = entry;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
        isCurrentUser ? "border-gold bg-gold/10" : "border-base"
      }`}
    >
      <span className="w-5 text-center text-sm font-bold text-muted">{rank}</span>
      <img src="/avatars/default-avatar.webp" alt={student.name} className="h-9 w-9 rounded-full object-cover" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">{student.name}</p>
        <p className="text-[11px] text-muted">Grade {student.gradeLevel} · {student.section}</p>
      </div>
      <RankBadge rank={student.overallRank} size="md" />
    </div>
  );
}
