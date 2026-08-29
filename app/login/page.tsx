import { Suspense } from "react";
import { LandingBackground } from "@/components/landing/Background";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { NativeLogin } from "@/components/native/NativeLogin";

// Standalone Android export build: "/login" renders the dedicated Android
// mobile-first login screen (NativeLogin). The web deployment (no
// CAPACITOR_EXPORT) keeps the existing desktop login UI unchanged.
export const dynamic =
  process.env.CAPACITOR_EXPORT === "1" ? ("force-static" as const) : undefined;

export default function LoginPage() {
  if (process.env.CAPACITOR_EXPORT === "1") {
    return (
      <Suspense fallback={null}>
        <NativeLogin />
      </Suspense>
    );
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />
      <div className="relative z-[2] flex w-full justify-center">
        <Suspense fallback={null}>
          <AuthCard>
            <AuthTabs defaultTab="login" />
          </AuthCard>
        </Suspense>
      </div>
    </main>
  );
}
