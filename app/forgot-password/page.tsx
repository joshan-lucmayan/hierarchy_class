import { Suspense } from "react";
import { LandingBackground } from "@/components/landing/Background";
import { AuthCard } from "@/components/auth/AuthCard";
import { NativeForgotPassword } from "@/components/native/NativeForgotPassword";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

// Standalone Android export build: "/forgot-password" renders the dedicated
// Android mobile-first forgot-password screen. The web deployment (no
// CAPACITOR_EXPORT) keeps the existing desktop forgot-password UI unchanged.
export const dynamic =
  process.env.CAPACITOR_EXPORT === "1" ? ("force-static" as const) : undefined;

export default function ForgotPasswordPage() {
  if (process.env.CAPACITOR_EXPORT === "1") {
    return (
      <Suspense fallback={null}>
        <NativeForgotPassword />
      </Suspense>
    );
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />
      <div className="relative z-[2] flex w-full justify-center">
        <AuthCard>
          <ForgotPasswordForm />
        </AuthCard>
      </div>
    </main>
  );
}
