import { CrownMark } from "@/components/ui/CrownMark";

/**
 * Auth-page brand lockup - the crown sits at 38px with a soft pulse and two
 * twinkling sparkles, the wordmark uses the Cinzel display face with a slow
 * light shimmer, and the tagline sits below in mono. Used on the landing auth
 * card and the login/signup/forgot/reset cards.
 */
export function LogoLockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ animation: "crownPulse 3.6s ease-in-out infinite" }}>
        <span
          className="pointer-events-none absolute -top-2 -right-9 select-none text-[12px] text-[var(--gold)]"
          style={{ animation: "twinkle 3s ease-in-out 0.8s infinite", textShadow: "0 0 10px rgba(158,167,179,0.7)" }}
          aria-hidden
        >
          ✦
        </span>
        <span
          className="pointer-events-none absolute -bottom-2 -left-10 select-none text-[9px] text-[var(--gold)]"
          style={{ animation: "twinkle 3.6s ease-in-out 1.6s infinite", textShadow: "0 0 10px rgba(158,167,179,0.7)" }}
          aria-hidden
        >
          ✦
        </span>
        <CrownMark height={38} />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="wordmark-shimmer font-display text-[18px] font-semibold uppercase tracking-[0.12em]">
          Hierarchy Class
        </h1>
        <p className="font-mono-ui text-center text-[9px] font-medium uppercase leading-relaxed tracking-[0.16em] text-[var(--gold)]">
          Make school feel like a game worth playing
        </p>
      </div>
    </div>
  );
}
