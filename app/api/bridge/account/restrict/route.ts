import { NextResponse } from "next/server";
import { adminRestrictUser } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/**
 * School admin temporarily restricts a suspicious account in their own
 * school. Authorization is re-verified server-side (see
 * lib/server/accountOps.adminRestrictUser).
 */
export async function POST(request: Request) {
  let body: { profileId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.profileId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing profileId." }, { status: 400 });
  }

  const result = await adminRestrictUser(body.profileId, body.reason);
  return NextResponse.json(result);
}
