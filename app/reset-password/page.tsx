import { Suspense } from "react";
import { LandingBackground } from "@/components/landing/Background";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { NativeResetPassword } from "@/components/native/NativeResetPassword";

// Standalone Android export build: "/reset-password" renders the dedicated
// Android mobile-first reset-password screen. The web deployment (no
// CAPACITOR_EXPORT) keeps the existing desktop reset-password UI unchanged.
export const dynamic =
  process.env.CAPACITOR_EXPORT === "1" ? ("force-static" as const) : undefined;

export default function ResetPasswordPage() {
  if (process.env.CAPACITOR_EXPORT === "1") {
    return (
      <Suspense fallback={null}>
        <NativeResetPassword />
      </Suspense>
    );
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />
      <div className="relative z-[2] flex w-full justify-center">
        <AuthCard>
          <ResetPasswordForm />
        </AuthCard>
      </div>
    </main>
  );
}
