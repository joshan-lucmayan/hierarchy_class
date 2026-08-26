import Link from "next/link";
import { CrownMark } from "@/components/ui/CrownMark";

export function BrandMark({ href = "/student/home" }: { href?: string }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <CrownMark height={40} className="shrink-0" />
      <span className="min-w-0 truncate text-sm font-bold uppercase tracking-[0.12em] text-muted">
        Hierarchy Class
      </span>
    </Link>
  );
}
