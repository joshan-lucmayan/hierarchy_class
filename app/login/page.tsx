import { Suspense } from "react";
import { LandingBackground } from "@/components/landing/Background";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthTabs } from "@/components/auth/AuthTabs";

export default function LoginPage() {
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
