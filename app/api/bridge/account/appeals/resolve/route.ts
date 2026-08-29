import { NextResponse } from "next/server";
import { resolveAppeal } from "@/lib/server/accountOps";

export const dynamic = "force-dynamic";

/** School admin approves/denies an appeal (see lib/server/accountOps.ts). */
export async function POST(request: Request) {
  let body: { appealId?: string; approved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.appealId !== "string" || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "Missing appealId or approved." }, { status: 400 });
  }

  const result = await resolveAppeal(body.appealId, body.approved);
  return NextResponse.json(result);
}
