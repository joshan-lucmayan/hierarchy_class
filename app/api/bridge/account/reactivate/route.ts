import { NextResponse } from "next/server";
import { reactivateAccount } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/** Self-service account reactivation (see lib/server/accountOps.ts). */
export async function POST() {
  const result = await reactivateAccount();
  return NextResponse.json(result);
}
