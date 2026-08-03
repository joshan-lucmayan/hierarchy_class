import { Suspense } from "react";
import { LogoLockup } from "@/components/auth/LogoLockup";
import { LoginForm } from "@/components/auth/LoginForm";

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute h-6 w-6 border-gold"; // slightly larger for stronger framing
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
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="relative w-full max-w-sm rounded-2xl border-2 border-gold bg-surface p-10 shadow-xl sm:p-12">
        {/* Decorative corner brackets */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        {/* Content */}
        <div className="flex flex-col items-center gap-10">
          {/* Logo prominently displayed */}
          <LogoLockup />

          {/* Divider line for game-like framing */}
          <div className="w-full border-t border-gold opacity-60" />

          {/* Login form */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
