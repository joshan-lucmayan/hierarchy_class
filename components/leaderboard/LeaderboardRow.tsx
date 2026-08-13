import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { TierRank } from "@/lib/classroomHierarchyStore";

interface LeaderboardRowStudent {
  id: string;
  name: string;
  avatarUrl?: string | null;
  program: string;
  levelLabel: string;
  educationalLevel: string;
  score: number | null;
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
      className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
        isCurrentUser ? "border-gold bg-gold/10" : "border-base"
      }`}
    >
      <span className="w-5 text-center text-sm font-bold text-muted">{rank}</span>
      <UserAvatar name={student.name} src={student.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy">{student.name}</p>
        <p className="truncate text-[11px] text-muted">
          {[student.educationalLevel, student.levelLabel, student.program].filter(Boolean).join(" · ")}
        </p>
      </div>
      <RankBadge rank={student.overallRank} size="md" />
    </div>
  );
}
