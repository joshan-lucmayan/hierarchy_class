import { NextResponse } from "next/server";
import { deactivateAccount } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/**
 * Self-service account deactivation. The caller's own session cookie is the
 * authorization (same as the legacy server action); RLS is the final gate.
 */
export async function POST() {
  const result = await deactivateAccount();
  return NextResponse.json(result);
}
