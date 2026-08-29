import { NextResponse } from "next/server";
import { adminUnrestrictUser } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/** School admin lifts a temporary restriction (see lib/server/accountOps.ts). */
export async function POST(request: Request) {
  let body: { profileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.profileId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing profileId." }, { status: 400 });
  }

  const result = await adminUnrestrictUser(body.profileId);
  return NextResponse.json(result);
}
