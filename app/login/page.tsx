import { Suspense } from "react";
import { LogoLockup } from "@/components/auth/LogoLockup";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-8">
        <div className="flex flex-col items-center gap-8">
          <LogoLockup />
          <div className="w-full border-t border-base" />
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
