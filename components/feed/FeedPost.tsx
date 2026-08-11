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
  return (
    <CornerFrame className="overflow-hidden rounded-3xl border border-base bg-surface shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
      {post.imageUrl && (
        <div className="w-full bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.title} className="h-auto w-full object-contain" />
        </div>
      )}
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gold bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy">
            {post.tag}
          </span>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {AUDIENCE_LABEL[post.audience] ?? "School"}
          </span>
        </div>
        <p className="mt-3 text-base font-semibold text-navy">{post.title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{post.body}</p>
        <p className="mt-3 text-[11px] text-muted">
          {post.authorName ? `Posted by ${post.authorName}` : "Posted by admin"} · {formatDate(post.createdAt)}
        </p>
      </div>
    </CornerFrame>
  );
}
