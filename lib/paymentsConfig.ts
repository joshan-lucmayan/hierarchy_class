/**
 * Master switch for the Florin top-up (PayMongo) feature.
 *
 * Payments are temporarily DISABLED while the PayMongo integration is
 * reworked. While this is false:
 *   - The purchase modal shows a "coming soon" state (no purchase path).
 *   - POST /api/payments/create-checkout refuses with 503.
 *   - GET /api/payments/packages refuses with 503.
 * The webhook route stays active so any session that was already paid before
 * the disable can still be credited.
 *
 * To re-enable, flip PAYMENTS_ENABLED to true. (The pending-session reuse
 * lookup in lib/paymongo.ts getCheckoutSessionStatus now calls the /v2
 * checkout_sessions endpoint; run the e2e runbook in docs/PAYMENTS.md before
 * going live - it has never been executed end to end.)
 */
export const PAYMENTS_ENABLED = false;

export const PAYMENTS_DISABLED_MESSAGE =
  "Florin top-ups are coming soon. Purchases are temporarily unavailable.";
