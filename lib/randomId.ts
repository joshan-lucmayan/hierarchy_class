/**
 * Cryptographically random id, with a fallback for non-secure contexts.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or
 * localhost). When the app is tested over plain HTTP on a LAN address it
 * throws a TypeError, which silently breaks optimistic updates and uploads.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
