import { BrandMark } from "@/components/navigation/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader({ href }: { href?: string }) {
  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-base bg-surface px-5 py-3">
      <BrandMark href={href} />
      <ThemeToggle />
    </header>
  );
}
