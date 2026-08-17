/**
 * Resolves the deployment base URL used for auth redirect links
 * (email confirmation, password recovery).
 *
 * NEXT_PUBLIC_SITE_URL must be set in production so confirmation links always
 * point at the real domain - never a hardcoded URL. Local development falls
 * back to localhost. Returns null when the deployment is misconfigured.
 */
export function siteUrlBase(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (siteUrl) return siteUrl;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

/** "/auth/callback" with any extra query params appended. */
export function authCallbackUrl(extra?: string): string {
  const base = siteUrlBase() ?? "";
  return `${base}/auth/callback${extra ? `?${extra}` : ""}`;
}
