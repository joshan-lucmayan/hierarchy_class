import { BrandMark } from "@/components/navigation/BrandMark";
import { NotificationBell } from "@/components/navigation/NotificationBell";

export function SiteHeader({ href }: { href?: string }) {
  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-base bg-surface px-5 py-3">
      <div className="xl:hidden">
        <BrandMark href={href} />
      </div>
      <div className="hidden xl:block" />
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </header>
  );
}
