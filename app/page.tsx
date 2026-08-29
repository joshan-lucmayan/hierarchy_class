import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/supabase/auth";
import { homePathForRole } from "@/lib/authz";
import { Landing } from "@/components/landing/Landing";
import { NativeRootGate } from "@/components/native/NativeRootGate";

// Standalone Android export build: there is no server, so the page renders
// statically. The static HTML of "/" IS the minimal native entry screen
// (NativeRootGate → NativeEntry boot state), so a cold start paints the clean
// app entry immediately and the client gate resolves the persisted session
// from there. The web deployment (no CAPACITOR_EXPORT) keeps the dynamic
// server redirect into the marketing Landing.
export const dynamic =
  process.env.CAPACITOR_EXPORT === "1" ? ("force-static" as const) : undefined;

export default async function RootPage() {
  if (process.env.CAPACITOR_EXPORT !== "1") {
    const { role } = await getServerProfile(
      cookies() as unknown as Parameters<typeof getServerProfile>[0]
    );

    // Role comes from the profiles table (database truth), never from
    // user_metadata which the user can edit themselves.
    if (role) redirect(homePathForRole(role));

    return <Landing />;
  }

  return <NativeRootGate />;
}
