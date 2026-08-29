import { NextResponse } from "next/server";
import { signUpWithProfile, type SignUpInput } from "@/lib/server/authOps";

export const dynamic = "force-dynamic";

/**
 * Public signup bridge. Same contract as the legacy server action
 * (lib/server/authOps.signUpWithProfile): validation, school-eligibility
 * checks, and profile creation all happen server-side. Used by the web app
 * and the standalone Android app through lib/bridgeClient.ts.
 */
export async function POST(request: Request) {
  let input: SignUpInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await signUpWithProfile(input);
  return NextResponse.json(result);
}
