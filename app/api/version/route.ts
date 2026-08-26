import { NextResponse } from "next/server";
import { version } from "../../../package.json";

export const dynamic = "force-dynamic";

/**
 * Lightweight deployment-identity probe for the global app-update system.
 *
 * - On Vercel, VERCEL_GIT_COMMIT_SHA is injected per deployment (build AND
 *   runtime), so every deploy yields a distinct build string.
 * - Locally / outside Vercel it falls back to the package.json version.
 *
 * no-store: the whole point is that clients must never see a stale answer.
 * No secrets, no database, no auth — safe to call from any client.
 */
export function GET() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA || `v${version}`;
  return NextResponse.json(
    { build, version },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
