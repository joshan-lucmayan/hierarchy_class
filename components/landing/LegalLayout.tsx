import { CrownMark } from "@/components/ui/CrownMark";
import { LandingBackground } from "./Background";

/**
 * Shared layout for the legal pages: the atmospheric background, a centered
 * prose column, and a small header with the brand and a back link.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      <LandingBackground />
      <div className="relative z-[2] mx-auto max-w-[760px] px-6 py-16">
        <header className="mb-12 flex flex-col items-center gap-5 text-center">
          <a href="/" className="flex items-center gap-2.5">
            <CrownMark height={26} className="text-[var(--accent)]" />
            <span className="font-display text-[15px] font-semibold uppercase tracking-[0.12em] text-[#eceef1]">
              Hierarchy Class
            </span>
          </a>
          <a href="/" className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] transition hover:text-[#eceef1]">
            Back to home
          </a>
        </header>

        <div className="rounded-2xl border border-base bg-[rgba(23,24,27,0.72)] p-8 backdrop-blur-sm sm:p-12">
          <h1 className="font-display mb-2 text-3xl font-semibold text-[#eceef1]">{title}</h1>
          <p className="font-mono-ui mb-10 text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Last updated: {updated}
          </p>
          <div className="flex flex-col gap-8 text-[14px] leading-[1.75] text-[var(--muted)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[16px] font-bold text-[#eceef1]">{heading}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2 pl-5">
      {items.map((item) => (
        <li key={item} className="list-disc">
          {item}
        </li>
      ))}
    </ul>
  );
}
