import Link from "next/link";
import { CrownMark } from "@/components/ui/CrownMark";

export function BrandMark({ href = "/student/home" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <CrownMark height={40} />
      <span className="text-sm font-bold uppercase tracking-[0.12em] text-muted">
        Hierarchy Class
      </span>
    </Link>
  );
}
