"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogout() {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setIsLoading(false);

    if (error) {
      setMessage("Unable to sign out. Please try again.");
      return;
    }

    window.location.href = "/login";
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-full border border-base bg-surface px-5 py-3 text-sm font-semibold text-navy transition hover:border-navy hover:text-navy disabled:opacity-70"
      >
        {isLoading ? "Signing out..." : "Logout"}
      </button>
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
