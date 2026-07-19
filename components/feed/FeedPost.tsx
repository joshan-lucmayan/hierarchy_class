import Image from "next/image";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { SchoolPost } from "@/data/schoolFeed";

export function FeedPost({ post }: { post: SchoolPost }) {
  return (
    <CornerFrame className="overflow-hidden rounded-3xl border border-base bg-surface shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full bg-navy">
        <Image src={post.image} alt={post.title} fill className="object-cover" />
      </div>
      <div className="p-6">
        <span className="rounded-full border border-gold bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-navy">
          {post.tag}
        </span>
        <p className="mt-3 text-base font-semibold text-navy">{post.title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{post.body}</p>
      </div>
    </CornerFrame>
  );
}
