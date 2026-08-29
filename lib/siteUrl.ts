/**
 * True inside the standalone Android export bundle.
 *
 * Uses the NEXT_PUBLIC_CAPACITOR_EXPORT mirror set by next.config.js: the
 * build-time CAPACITOR_EXPORT var is only visible server-side and is NOT
 * inlined into client bundles, but auth components that call siteUrlBase /
 * backendUrl run on the client (bundled frontend). This flag is inlined as
 * "1"/"0" into both server and client bundles, so it always reflects the
 * build that produced the running bundle.
 */
function isAndroidExportBundle(): boolean {
  if (process.env.NEXT_PUBLIC_CAPACITOR_EXPORT === "1") return true;
  return process.env.CAPACITOR_EXPORT === "1";
}

/**
 * Resolves the deployment base URL used for auth redirect links
 * (email confirmation, password recovery).
 *
 * NEXT_PUBLIC_SITE_URL must be set in production so confirmation links always
 * point at the real domain - never a hardcoded URL. Local development falls
 * back to localhost. Returns null when the deployment is misconfigured.
 */
export function siteUrlBase(): string | null {
  // Standalone Android export: there is no server and no NEXT_PUBLIC_SITE_URL
  // is baked in, so auth redirect links (password reset, email confirmation)
  // must point at the deployed backend, which hosts the /auth/callback route.
  if (isAndroidExportBundle()) {
    return PRODUCTION_ORIGIN;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (siteUrl) return siteUrl;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

/** "/auth/callback" with any extra query params appended. */
export function authCallbackUrl(extra?: string): string {
  const base = siteUrlBase() ?? "";
  return `${base}/auth/callback${extra ? `?${extra}` : ""}`;
}

/**
 * Origin of the deployed backend that serves the /api/* route handlers.
 *
 * The standalone Android app bundles the frontend locally, so its fetches to
 * relative /api paths would hit the on-device origin - they must target the
 * deployed backend instead. On the web the deployment IS this origin, so the
 * same-origin relative path is returned unchanged.
 */
export const PRODUCTION_ORIGIN = "https://www.hierarchyclass.com";

/** Absolute URL for a backend API path (see above). */
export function backendUrl(path: string): string {
  // Build-time selection: only the Android export bundle (built with
  // CAPACITOR_EXPORT=1) bakes in the absolute backend origin. The web bundle
  // keeps same-origin relative paths, exactly as before.
  if (isAndroidExportBundle()) {
    return `${PRODUCTION_ORIGIN}${path}`;
  }
  return path;
}
