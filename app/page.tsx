import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/supabase/auth";
import { homePathForRole } from "@/lib/authz";
import { Landing } from "@/components/landing/Landing";

export default async function RootPage() {
  const { role } = await getServerProfile(
    cookies() as unknown as Parameters<typeof getServerProfile>[0]
  );

  // Role comes from the profiles table (database truth), never from
  // user_metadata which the user can edit themselves.
  if (role) redirect(homePathForRole(role));

  return <Landing />;
}
