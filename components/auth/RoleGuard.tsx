"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const VALID_ROLES = ["student", "teacher", "admin"] as const;

type RoleType = (typeof VALID_ROLES)[number];

type RoleGuardProps = {
  role: RoleType;
};

export function RoleGuard({ role }: RoleGuardProps) {
  const [status, setStatus] = useState<"loading" | "allowed" | "blocked">("loading");
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const metadata = data.user.user_metadata as Record<string, unknown> | null;
      const roleValue = typeof metadata?.role === "string" ? metadata.role.toLowerCase() : null;
      if (!roleValue || !VALID_ROLES.includes(roleValue as RoleType)) {
        router.replace("/login");
        return;
      }

      if (roleValue !== role) {
        router.replace(`/${roleValue}/home`);
        return;
      }

      setStatus("allowed");
    }

    checkRole();
  }, [router, role]);

  if (status !== "allowed") {
    return (
      <div className="flex min-h-[56vh] items-center justify-center px-4">
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center text-sm text-[var(--muted)]">
          Verifying access…
        </div>
      </div>
    );
  }

  return null;
}
