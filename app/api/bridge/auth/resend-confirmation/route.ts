import { NextResponse } from "next/server";
import { resendSignupConfirmation } from "@/lib/server/authOps";

export const dynamic = "force-dynamic";

/**
 * Resend the signup confirmation email. Deliberately generic response -
 * never reveals whether the account exists.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await resendSignupConfirmation(typeof body.email === "string" ? body.email : "");
  return NextResponse.json(result);
}
