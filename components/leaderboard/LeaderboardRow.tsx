import { RankBadge } from "@/components/ui/RankBadge";
import type { TierRank } from "@/lib/classroomHierarchyStore";

interface LeaderboardRowStudent {
  id: string;
  name: string;
  avatarUrl?: string | null;
  program: string;
  levelLabel: string;
  section: string;
  overallRank: TierRank;
}

export function LeaderboardRow({
  rank,
  student,
  isCurrentUser,
}: {
  rank: number;
  student: LeaderboardRowStudent;
  isCurrentUser?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
        isCurrentUser ? "border-gold bg-gold/10" : "border-base"
      }`}
    >
      <span className="w-5 text-center text-sm font-bold text-muted">{rank}</span>
      <img
        src={student.avatarUrl || "/avatars/default-avatar.webp"}
        alt={student.name}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">{student.name}</p>
        <p className="text-[11px] text-muted">
          {[student.program, student.levelLabel, student.section].filter(Boolean).join(" · ")}
        </p>
      </div>
      <RankBadge rank={student.overallRank} size="md" />
    </div>
  );
}
