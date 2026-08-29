import { NextResponse } from "next/server";
import { submitAppeal } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/** Restricted user submits an appeal (see lib/server/accountOps.ts). */
export async function POST(request: Request) {
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await submitAppeal(typeof body.reason === "string" ? body.reason : "");
  return NextResponse.json(result);
}
