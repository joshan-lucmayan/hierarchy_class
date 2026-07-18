import { LogoLockup } from "@/components/auth/LogoLockup";
import { LoginForm } from "@/components/auth/LoginForm";

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

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-base bg-surface p-8 shadow-card sm:p-10">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
        <div className="flex flex-col items-center gap-8">
          <LogoLockup />
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
