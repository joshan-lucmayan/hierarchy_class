import { CornerFrame } from "@/components/ui/CornerFrame";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { SchoolPost } from "@/lib/schoolFeedStore";

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "School",
  students: "Students",
  teachers: "Teachers",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FeedPost({ post }: { post: SchoolPost }) {
  const isAnnouncement = post.type === "announcement";

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface">
      <div className="p-5">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <UserAvatar name={post.authorName ?? "Admin"} src={post.authorAvatar} size="md" profileId={post.authorId} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[13.5px] font-semibold text-navy">
                {post.authorName ?? "Administrator"}
              </p>
              {post.authorRole === "admin" && (
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted">
                  Administrator
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-muted">{formatDate(post.createdAt)}</p>
          </div>
        </div>

        {/* Tag row - category tag uses the accent border/text, others neutral */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2.5 py-1 text-[10.5px] font-medium tracking-[0.5px] ${
              isAnnouncement
                ? "border-sealion text-gold-token"
                : "border-line text-muted"
            }`}
          >
            {post.tag}
          </span>
          <span className="rounded border border-line px-2.5 py-1 text-[10.5px] font-medium tracking-[0.5px] text-muted">
            {AUDIENCE_LABEL[post.audience] ?? "School"}
          </span>
        </div>

        {post.title && (
          <p className="mt-3 break-words text-base font-bold text-navy">{post.title}</p>
        )}
        <p
          className={`${post.title ? "mt-1.5" : "mt-3"} break-words whitespace-pre-wrap text-[13px] leading-[1.6] text-muted`}
        >
          {post.body}
        </p>

        {post.imageUrl && (
          <div className="mt-4 w-full overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt={post.title ?? post.body} className="h-auto w-full object-contain" />
          </div>
        )}
      </div>
    </CornerFrame>
  );
}
