import { LogoLockup } from "@/components/auth/LogoLockup";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-8">
        <div className="flex flex-col items-center gap-8">
          <LogoLockup />
          <div className="w-full">
            <h1 className="text-xl font-bold uppercase tracking-[0.15em] text-navy">
              Create an account. If you have not created yet.
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
