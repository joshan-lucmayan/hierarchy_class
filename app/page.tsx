import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserMetadata, normalizeRole } from "@/lib/supabase/auth";
import { Landing } from "@/components/landing/Landing";

export default async function RootPage() {
  const metadata = await getUserMetadata(
    cookies() as unknown as Parameters<typeof getUserMetadata>[0]
  );

  if (metadata) {
    const role = normalizeRole(metadata.role);
    if (role) redirect(`/${role}/home`);
  }

  return <Landing />;
}
