import { CrownMark } from "@/components/ui/CrownMark";

/**
 * Auth-page brand lockup - the crown sits large (96px tall) and centered
 * above the app name, used on the login/signup/forgot/reset cards. The
 * surrounding layout centers it horizontally.
 */
export function LogoLockup() {
  return (
    <div className="flex flex-col items-center gap-4">
      <CrownMark height={96} />

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-2xl font-bold uppercase tracking-[0.15em] text-navy">
          Hierarchy Class
        </h1>
        <div className="h-[2px] w-10 bg-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
          Climb the ranks
        </p>
      </div>
    </div>
  );
}
