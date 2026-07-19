import { BrandMark } from "@/components/navigation/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function SiteHeader({ href }: { href?: string }) {
  return (
    <header className="mb-4 flex items-center justify-between rounded-2xl border border-base bg-surface px-5 py-3">
      <BrandMark href={href} />
      <div className="flex items-center gap-2">
        <ChatWidget />
        <ThemeToggle />
      </div>
    </header>
  );
}
