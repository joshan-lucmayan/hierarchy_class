import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Static security-contract guards for the GCash/PayMongo payment system.
 *
 * Like migrationGuard.test.ts, this suite pins invariants in the migration
 * text and route source so a future refactor cannot silently drop them. It
 does NOT exercise RLS against a live database (see docs/SECURITY.md).
 */

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const M067 = read("../database/migrations/067_payment_system.sql");
const M068 = read("../database/migrations/068_complete_payment_rpc.sql");
const M069 = read("../database/migrations/069_payment_hardening.sql");
const WEBHOOK = read("../app/api/payments/webhook/route.ts");
const CHECKOUT = read("../app/api/payments/create-checkout/route.ts");
const PACKAGES = read("../app/api/payments/packages/route.ts");
const SUCCESS = read("../app/payment/success/page.tsx");
const CANCEL = read("../app/payment/cancel/page.tsx");
const PAYMONGO = read("./paymongo.ts");

// ---------------------------------------------------------------------------
// Schema contracts (067)
// ---------------------------------------------------------------------------

test("067: payment status lifecycle is constrained to the five intended states", () => {
  assert.ok(
    M067.includes("CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired'))"),
    "status CHECK must pin pending/completed/failed/cancelled/expired"
  );
});

test("067: webhook dedup table has UNIQUE (provider, event_id)", () => {
  const block = M067.split("CREATE TABLE IF NOT EXISTS processed_webhook_events")[1] ?? "";
  assert.ok(block.includes("UNIQUE (provider, event_id)"), "dedup must key on (provider, event_id)");
});

test("067: clients get NO write path on payment_transactions", () => {
  // No INSERT/UPDATE/DELETE policies may exist on payment_transactions -
  // every write goes through the service-role webhook/checkout routes only.
  const insertPolicies = M067.match(/CREATE POLICY "[^"]+" ON payment_transactions\s+FOR (INSERT|UPDATE|DELETE)/g);
  assert.equal(insertPolicies, null, "no INSERT/UPDATE/DELETE policies may exist on payment_transactions");
});

test("067: student payment reads are ownership-bound via profiles.user_id = auth.uid()", () => {
  const policy = M067.split('CREATE POLICY "payments_student_read"')[1] ?? "";
  assert.ok(
    policy.includes("student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())"),
    "student read policy must resolve identity through profiles.user_id = auth.uid()"
  );
});

test("067: admin payment reads are school-scoped to their own school", () => {
  const policy = M067.split('CREATE POLICY "payments_admin_read"')[1] ?? "";
  assert.ok(policy.includes("p.role = 'admin'"), "admin gate must check profile role");
  assert.ok(policy.includes("p.school_id = payment_transactions.school_id"), "admin scope must stay same-school");
});

test("067: processed_webhook_events is RLS-locked with no client policies", () => {
  const block = M067.split("ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY")[1] ?? "";
  assert.ok(!block.includes("CREATE POLICY"), "no policies may follow the RLS enablement");
});

// ---------------------------------------------------------------------------
// complete_payment RPC contracts (068 + 069)
// ---------------------------------------------------------------------------

test("complete_payment is SECURITY DEFINER with a pinned search_path", () => {
  for (const sql of [M068, M069]) {
    assert.ok(sql.includes("SECURITY DEFINER"), "SECURITY DEFINER required");
    assert.ok(sql.includes("SET search_path = public"), "search_path must be pinned to public");
  }
});

test("complete_payment is executable by service_role ONLY", () => {
  // 069 re-issues the grants; both files must agree.
  for (const sql of [M068, M069]) {
    assert.ok(sql.match(/GRANT EXECUTE ON FUNCTION public\.complete_payment\(UUID\) TO service_role/),
      "service_role must be granted EXECUTE");
    assert.ok(sql.match(/REVOKE EXECUTE ON FUNCTION public\.complete_payment\(UUID\) FROM authenticated/),
      "authenticated must be revoked");
    assert.ok(sql.match(/REVOKE EXECUTE ON FUNCTION public\.complete_payment\(UUID\) FROM anon/),
      "anon must be revoked");
  }
  // PostgreSQL grants EXECUTE to PUBLIC on new functions by default - the
  // hardening pass must explicitly close that path.
  assert.ok(M069.match(/REVOKE EXECUTE ON FUNCTION public\.complete_payment\(UUID\) FROM PUBLIC/),
    "PUBLIC default grant must be revoked in 069");
});

test("complete_payment locks the row and only processes pending transactions", () => {
  const fn = M069.split("AS $$")[1] ?? "";
  assert.ok(fn.includes("FOR UPDATE"), "row lock required for concurrent safety");
  assert.ok(fn.includes("IF v_tx.status <> 'pending'"), "non-pending transactions must be refused");
  assert.ok(fn.includes("'already_processed'"), "refusal must surface as already_processed");
});

test("complete_payment credits Florin exactly once per transaction", () => {
  const fn = M069.split("AS $$")[1] ?? "";
  // Credit must upsert so a missing balance row cannot swallow a paid credit.
  assert.ok(fn.includes("INSERT INTO florin_balances (student_id, balance)"), "balance credit must upsert");
  assert.ok(fn.includes("ON CONFLICT (student_id)"), "upsert conflict target required");
  assert.ok(fn.includes("florin_balances.balance + v_tx.florin_amount"), "credit adds the snapshot amount");
  // Ledger entry accompanies every credit.
  assert.ok(fn.includes("INSERT INTO florin_transactions"), "ledger entry required alongside credit");
  // Status flips to completed in the same call - never back out of terminal states.
  assert.ok(fn.includes("SET status = 'completed'"), "transaction must be marked completed");
  assert.ok(!fn.includes("status = 'pending'") || fn.includes("<> 'pending'"),
    "must never reset a transaction back to pending");
});

test("069: one pending checkout per student is enforced at the schema level", () => {
  assert.ok(
    M069.match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_one_pending_per_student\s+ON payment_transactions \(student_id\)\s+WHERE status = 'pending'/),
    "partial unique index must cap pending transactions at one per student"
  );
});

// ---------------------------------------------------------------------------
// Webhook route contracts
// ---------------------------------------------------------------------------

test("webhook verifies the signature over the RAW body before parsing JSON", () => {
  const rawIdx = WEBHOOK.indexOf("await request.text()");
  const verifyIdx = WEBHOOK.indexOf("verifyWebhookSignature(rawBody");
  const parseIdx = WEBHOOK.indexOf("JSON.parse(rawBody)");
  assert.ok(rawIdx !== -1 && verifyIdx !== -1 && parseIdx !== -1, "all three steps present");
  assert.ok(rawIdx < verifyIdx && verifyIdx < parseIdx, "order must be raw -> verify -> parse");
});

test("webhook signature verification uses timing-safe comparison", () => {
  assert.ok(PAYMONGO.includes("crypto.timingSafeEqual"), "timing-safe compare required");
  assert.ok(PAYMONGO.includes("createHmac('sha256', webhookSecret)"), "HMAC-SHA256 keyed by webhook secret");
});

test("webhook rejects unknown event types and validates the payload shape", () => {
  assert.ok(WEBHOOK.includes("'checkout_session.payment.paid'"), "event type allow-list required");
  assert.ok(WEBHOOK.includes("session.type !== 'checkout_session'"), "session resource type checked");
  assert.ok(WEBHOOK.includes("referenceNumber"), "trusted reference lookup required");
});

test("webhook cross-checks provider session id, amount, currency, and payment status", () => {
  assert.ok(WEBHOOK.includes("tx.provider_session_id !== checkoutSessionId"), "session ID mismatch guard");
  assert.ok(WEBHOOK.includes("paymentAmount !== expectedAmountCentavos"), "amount mismatch guard");
  assert.ok(WEBHOOK.includes("paymentCurrency !== tx.currency"), "currency mismatch guard");
  assert.ok(WEBHOOK.includes("paymentStatus !== 'paid'"), "payment status must be 'paid'");
});

test("webhook records the dedup event AFTER completion succeeds (crash/retry safe)", () => {
  const rpcIdx = WEBHOOK.indexOf(".rpc('complete_payment'");
  // The INSERT into processed_webhook_events is the LAST touch of the table
  // in the file (the fast-path pre-check select happens earlier).
  const table = ".from('processed_webhook_events')";
  const insertIdx = WEBHOOK.lastIndexOf(table);
  assert.ok(rpcIdx !== -1, "complete_payment RPC call present");
  assert.ok(insertIdx > rpcIdx, "event INSERT must happen after the RPC call");
  assert.ok(
    WEBHOOK.slice(insertIdx).includes(".insert({"),
    "the final processed_webhook_events touch must be an INSERT"
  );
  // A failed RPC returns 500 WITHOUT recording, so PayMongo retries can recover.
  assert.ok(WEBHOOK.includes("'Payment completion failed'"), "RPC failure path present");
});

test("webhook never credits Florin directly - only through complete_payment", () => {
  assert.ok(!WEBHOOK.includes("florin_balances"), "no direct balance writes in the webhook");
  assert.ok(!WEBHOOK.includes('"florin_transactions"') && !WEBHOOK.includes("'florin_transactions'"),
    "no direct ledger writes in the webhook");
});

// ---------------------------------------------------------------------------
// Checkout route contracts
// ---------------------------------------------------------------------------

test("checkout authenticates server-side and rejects non-students", () => {
  assert.ok(CHECKOUT.includes("getServerProfile(request.cookies)"), "server-side auth required");
  assert.ok(CHECKOUT.includes("profile.role !== 'student'"), "student-only gate");
  assert.ok(CHECKOUT.includes("'Only students can purchase Florin'"), "explicit rejection");
});

test("checkout never trusts client-provided price, amount, or identity", () => {
  const body = CHECKOUT.split("const body: CheckoutRequest")[1] ?? "";
  assert.ok(body.includes("package_id"), "only package_id is read from the request");
  // Package snapshot comes from the database, active-only.
  const pkgBlock = CHECKOUT.split(".from('florin_packages')")[1] ?? "";
  assert.ok(pkgBlock.includes(".eq('active', true)"), "packages must be validated active from DB");
  // florin_amount / amount_php snapshots come from packageData, not the body.
  assert.ok(CHECKOUT.includes("florin_amount: packageData.florin_amount"));
  assert.ok(CHECKOUT.includes("amount_php: packageData.price_php"));
});

test("checkout reuses an active pending session instead of double-charging", () => {
  assert.ok(CHECKOUT.includes("reuseOrRetirePending"), "reuse helper present");
  assert.ok(CHECKOUT.includes("'23505'"), "unique-index race handled via PG constraint violation code");
  assert.ok(CHECKOUT.includes("getCheckoutSessionStatus"), "provider session status consulted before reuse");
});

test("checkout sends PayMongo's Idempotency-Key and never exposes secrets", () => {
  assert.ok(PAYMONGO.includes("'Idempotency-Key': params.referenceNumber"), "idempotency support used");
  assert.ok(PAYMONGO.includes("PAYMONGO_SECRET_KEY"), "secret key read server-side only");
  assert.ok(!CHECKOUT.includes("NEXT_PUBLIC_"), "checkout route must not leak config via NEXT_PUBLIC vars");
});

// ---------------------------------------------------------------------------
// Status page contracts
// ---------------------------------------------------------------------------

test("success page is READ-ONLY: no completion calls, no balance writes", () => {
  // The header docstring mentions the invariant by name; assert on actual
  // API usage instead of raw strings.
  assert.ok(!SUCCESS.includes(".rpc("), "success page must not invoke RPCs");
  assert.ok(!SUCCESS.includes("florin_balances"), "success page must not touch balances");
  assert.ok(!SUCCESS.includes(".update("), "success page must not update anything");
  assert.ok(SUCCESS.includes(".eq('student_id', profile!.id)"), "ownership filter required");
});

test("success page only claims success when the DATABASE says completed", () => {
  assert.ok(SUCCESS.includes("completed:"), "completed status branch exists");
  assert.ok(SUCCESS.includes("'Verifying Payment'"), "pending shows verification state, not success");
  assert.ok(SUCCESS.includes("retryCount < 10"), "bounded auto-refresh while pending");
});

test("cancel page is read-only", () => {
  assert.ok(!CANCEL.includes("supabase"), "cancel page performs no database access");
  assert.ok(!CANCEL.includes("fetch("), "cancel page performs no API calls");
});
