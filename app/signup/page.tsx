import { LogoLockup } from "@/components/auth/LogoLockup";
import { SignupForm } from "@/components/auth/SignupForm";

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute h-4 w-4 border-gold";
  const styles: Record<string, string> = {
    tl: "top-0 left-0 border-l-2 border-t-2",
    tr: "top-0 right-0 border-r-2 border-t-2",
    bl: "bottom-0 left-0 border-l-2 border-b-2",
    br: "bottom-0 right-0 border-r-2 border-b-2",
  };
  return <span className={`${base} ${styles[position]}`} />;
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-base bg-surface p-8 shadow-card sm:p-10">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
        <div className="flex flex-col items-center gap-8">
          <LogoLockup />
          <div className="w-full">
            <h1 className="text-xl font-bold uppercase tracking-[0.15em] text-navy">
              Create an account
            </h1>
            <p className="mt-2 text-sm text-muted">
              Register a new school account. If email confirmation is required, verify your address before signing in.
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
