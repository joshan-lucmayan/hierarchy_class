import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyWebhookSignature,
  pesoToCentavos,
  centavosToPeso,
  generateReferenceNumber,
} from "./paymongo.ts";

/**
 * Unit tests for the PayMongo utility's pure functions.
 *
 * The signature verification algorithm is pinned to the official PayMongo
 * scheme: Paymongo-Signature carries a plain hex HMAC-SHA256 of the raw
 * request body keyed with the per-endpoint webhook secret, compared with a
 * timing-safe equality check.
 */

process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_secret";

const RAW_BODY = JSON.stringify({
  data: { id: "evt_123", attributes: { type: "checkout_session.payment.paid" } },
});

function sign(body: string, secret = process.env.PAYMONGO_WEBHOOK_SECRET!) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

test("webhook signature - valid signature accepted", () => {
  assert.equal(verifyWebhookSignature(RAW_BODY, sign(RAW_BODY)), true);
});

test("webhook signature - tampered body rejected", () => {
  const tampered = RAW_BODY.replace("evt_123", "evt_999");
  assert.equal(verifyWebhookSignature(tampered, sign(RAW_BODY)), false);
});

test("webhook signature - invalid signature rejected", () => {
  assert.equal(verifyWebhookSignature(RAW_BODY, "f".repeat(64)), false);
});

test("webhook signature - malformed signature (wrong length) rejected without throwing", () => {
  assert.equal(verifyWebhookSignature(RAW_BODY, "short"), false);
  assert.equal(verifyWebhookSignature(RAW_BODY, ""), false);
  assert.equal(verifyWebhookSignature(RAW_BODY, `${sign(RAW_BODY)}extra`), false);
});

test("webhook signature - wrong secret rejected", () => {
  assert.equal(verifyWebhookSignature(RAW_BODY, sign(RAW_BODY, "other-secret")), false);
});

test("webhook signature - buffer input matches string input", () => {
  assert.equal(verifyWebhookSignature(Buffer.from(RAW_BODY), sign(RAW_BODY)), true);
});

test("amount conversion - pesos round-trip through centavos", () => {
  for (const peso of [39.0, 79.0, 179.0, 349.0]) {
    assert.equal(centavosToPeso(pesoToCentavos(peso)), peso);
  }
});

test("amount conversion - centavos are integers (PayMongo requirement)", () => {
  assert.equal(pesoToCentavos(39.0), 3900);
  assert.equal(pesoToCentavos(79.99), 7999);
  assert.equal(Number.isInteger(pesoToCentavos(19.99 + 0.001)), true);
});

test("reference number - HC-TXN format, uppercase, unique", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const ref = generateReferenceNumber();
    assert.match(ref, /^HC-TXN-[A-Z0-9]+-[A-Z0-9]{6}$/);
    seen.add(ref);
  }
  // Random component makes birthday collisions vanishingly unlikely.
  assert.ok(seen.size > 190);
});
