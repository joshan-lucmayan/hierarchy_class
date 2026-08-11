import { CornerFrame } from "@/components/ui/CornerFrame";
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
    <CornerFrame className={`overflow-hidden rounded-3xl border bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lg ${
      isAnnouncement ? "border-gold/60" : "border-base hover:border-gold"
    }`}>
      <div className="p-6">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <img
            src={post.authorAvatar || "/avatars/default-avatar.webp"}
            alt={post.authorName ?? "Admin"}
            className="h-10 w-10 shrink-0 rounded-full border border-base object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">
              {post.authorName ?? "Administrator"}
            </p>
            <p className="text-[11px] text-muted">{formatDate(post.createdAt)}</p>
          </div>
          {isAnnouncement && (
            <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
              Announcement
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy">
            {post.tag}
          </span>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {AUDIENCE_LABEL[post.audience] ?? "School"}
          </span>
        </div>

        {post.title && <p className="mt-3 text-base font-semibold text-navy">{post.title}</p>}
        <p className={`${post.title ? "mt-2" : "mt-3"} whitespace-pre-wrap text-sm leading-6 text-muted`}>{post.body}</p>

        {post.imageUrl && (
          <div className="mt-4 w-full overflow-hidden rounded-2xl border border-base bg-navy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt={post.title ?? post.body} className="h-auto w-full object-contain" />
          </div>
        )}
      </div>
    </CornerFrame>
  );
}
