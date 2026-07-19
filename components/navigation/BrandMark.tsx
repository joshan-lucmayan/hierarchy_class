import Link from "next/link";

export function BrandMark({ href = "/student/home" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <svg width="28" height="20" viewBox="0 0 72 52" fill="none">
        <rect x="0" y="30" width="18" height="22" rx="2" fill="var(--text)" />
        <rect x="24" y="18" width="18" height="34" rx="2" fill="var(--text)" />
        <rect x="48" y="6" width="18" height="46" rx="2" fill="var(--text)" />
        <path d="M57 0l3 6 6 1-4.5 4.5 1 6L57 14.5 51 17.5l1-6L47.5 7l6-1z" fill="#c9962c" />
      </svg>
      <span className="text-sm font-bold uppercase tracking-[0.12em] text-navy">
        Hierarchy Class
      </span>
    </Link>
  );
}
