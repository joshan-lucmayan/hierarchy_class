import { NextResponse } from "next/server";
import { resolveDeletionRequest } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/**
 * School admin approves/denies a pending deletion request. Approval executes
 * the permanent deletion server-side (see lib/server/accountOps.ts).
 */
export async function POST(request: Request) {
  let body: { requestId?: string; decision?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.requestId !== "string" || (body.decision !== "approved" && body.decision !== "denied")) {
    return NextResponse.json({ error: "Missing requestId or invalid decision." }, { status: 400 });
  }

  const result = await resolveDeletionRequest(body.requestId, body.decision);
  return NextResponse.json(result);
}
