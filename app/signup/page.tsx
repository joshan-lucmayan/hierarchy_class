import { LandingBackground } from "@/components/landing/Background";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { NativeSignup } from "@/components/native/NativeSignup";

// Standalone Android export build: "/signup" renders the dedicated Android
// mobile-first signup screen (NativeSignup). The web deployment (no
// CAPACITOR_EXPORT) keeps the existing desktop signup UI unchanged.
export const dynamic =
  process.env.CAPACITOR_EXPORT === "1" ? ("force-static" as const) : undefined;

export default function SignupPage() {
  if (process.env.CAPACITOR_EXPORT === "1") {
    return <NativeSignup />;
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />

      <div className="relative z-[2] flex w-full items-center justify-center">
        <AuthCard>
          <AuthTabs defaultTab="signup" />
        </AuthCard>
      </div>
    </main>
  );
}
