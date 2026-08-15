"use client";

import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

type Tab = "login" | "signup";

/**
 * Tabbed login/signup switcher from the landing design: a sliding pill sits
 * behind the active tab label. Both panels embed the real auth forms - no
 * mock logic, the forms do all the Supabase work.
 */
export function AuthTabs({ defaultTab = "login" }: { defaultTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="relative flex rounded-[10px] bg-[rgba(70,76,85,0.25)] p-1">
        <div
          className="absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-b from-[#c2c7cf] to-[#9ea7b3] shadow-[0_2px_12px_rgba(158,167,179,0.35)] transition-transform duration-300 ease-out"
          style={{ transform: tab === "signup" ? "translateX(100%)" : "translateX(0)" }}
        />
        {(["login", "signup"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative z-10 flex-1 rounded-lg px-3 py-2.5 font-mono-ui text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 ${
              tab === key ? "text-[#141214]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {key === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <div key={tab} style={{ animation: "fadeUp 0.4s ease" }}>
        {tab === "login" ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  );
}
