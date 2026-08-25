# Hierarchy Class - Florin Payments (GCash via PayMongo)

Students top up their **Florin** balance with real money through **PayMongo
Hosted Checkout**, paying with **GCash**. The browser never touches payment
credentials and never credits Florin - the **verified webhook is the only path
that completes a payment**, and it runs entirely server-side.

> **Verification status: IMPLEMENTATION VERIFIED LOCALLY.** TypeScript, the
> full test suite (including 33 payment-specific tests), lint, and the
> production build all pass. **PayMongo sandbox end-to-end verification is
> PENDING** - see [PayMongo Sandbox E2E Testing](#7-paymongo-sandbox-e2e-testing)
> for the full procedure. No real GCash payment or live webhook has been
> tested yet.

---

## Contents

1. [How a payment works](#1-how-a-payment-works)
2. [Payment states](#2-payment-states)
3. [Florin packages](#3-florin-packages)
4. [Database schema](#4-database-schema)
5. [Security model](#5-security-model)
6. [Environment configuration](#6-environment-configuration)
7. [PayMongo sandbox E2E testing](#7-paymongo-sandbox-e2e-testing)

---

## 1. How a payment works

```
Student -> Buy Florin modal (packages loaded from the database)
        -> POST /api/payments/create-checkout   (server auth + validation)
        -> PayMongo Checkout Session            (GCash only)
        -> browser redirects to PayMongo hosted page
        -> student pays with GCash
        -> PayMongo webhook -> /api/payments/webhook
             signature verify -> data cross-checks -> complete_payment()
        -> transaction completed + Florin credited + ledger entry
        -> success page reads the DATABASE status (read-only)
```

Key rule: **the success redirect is NOT proof of payment.** A student who
lands on `/payment/success?ref=...` sees "Verifying Payment" until the
database row actually says `completed`. Only the webhook - after signature
and data verification - can get it there.

### Components

| Piece | File | Role |
|---|---|---|
| Package catalog API | `app/api/payments/packages/route.ts` | Returns active packages to logged-in users |
| Checkout creation | `app/api/payments/create-checkout/route.ts` | Authenticates, validates the package server-side, creates/reuses the pending transaction + PayMongo session |
| Webhook | `app/api/payments/webhook/route.ts` | Verifies PayMongo's signature, cross-checks provider data, completes the payment |
| PayMongo client | `lib/paymongo.ts` | Server-only API wrapper (session create/retrieve, HMAC verification). Never imported from client code |
| Success page | `app/payment/success/page.tsx` | Read-only status display for the owner's own transaction; bounded auto-refresh while pending |
| Cancel page | `app/payment/cancel/page.tsx` | Static read-only notice |
| Purchase modal | `components/student/FlorinPurchaseModal.tsx` + `FlorinPackageCard.tsx` | Loads packages from the API, prevents double-submit, redirects to `checkout_url` |
| History | `components/student/PaymentHistory.tsx`, `PaymentStatusBadge.tsx` | Student's own recent transactions on the shop page |

### Checkout creation rules (`create-checkout`)

1. Resolves the caller from cookies via `getServerProfile` (database truth:
   `profiles.user_id = auth user id`); non-students are rejected.
2. Reads **only** `package_id` from the request body - price, Florin amount,
   student id, and school id always come from the database.
3. Loads the package from `florin_packages` with `active = true`; unknown or
   inactive packages are rejected.
4. Reuses an existing pending transaction when its PayMongo session is still
   `active` (same checkout URL returned, no double session). Expired sessions
   mark the transaction `expired`; unreachable providers mark it `failed`.
5. At most one pending transaction per student is enforced by a partial
   unique index (migration 069); a concurrent race reuses the winner's
   session instead of creating a second one.
6. Creates the PayMongo session with an `Idempotency-Key` (the internal
   reference number) and stores `provider_session_id`.
7. Returns only `{checkout_url, reference_number, status, transaction_id}`.

---

## 2. Payment states

`payment_transactions.status` is constrained by the database (migrations 067)
to exactly five values:

| State | Terminal? | Meaning |
|---|---|---|
| `pending` | no | Transaction created, awaiting webhook confirmation |
| `completed` | yes | Paid and credited; never processed again |
| `failed` | yes | Provider reported failure / lookup failure |
| `cancelled` | yes | Student abandoned the checkout |
| `expired` | yes | Provider confirmed the session expired |

There is no transition out of a terminal state - `complete_payment()`
processes **only** rows whose status is exactly `pending`.

---

## 3. Florin packages

Packages live in the `florin_packages` table (seeded by migration 067) and are
**server-authoritative**: the client selects a package by id, but the price,
Florin amount, and currency always come from the database row at checkout
time, and the amount snapshot is stored on the transaction.

| Package id | Name | Florin | Price |
|---|---|---:|---:|
| `50_florin` | 50 Florin Pack | 50 | PHP 39.00 |
| `120_florin` | 120 Florin Pack | 120 | PHP 79.00 |
| `300_florin` | 300 Florin Pack | 300 | PHP 179.00 |
| `650_florin` | 650 Florin Pack | 650 | PHP 349.00 |

---

## 4. Database schema

Migrations: [`067_payment_system.sql`](../database/migrations/067_payment_system.sql),
[`068_complete_payment_rpc.sql`](../database/migrations/068_complete_payment_rpc.sql),
[`069_payment_hardening.sql`](../database/migrations/069_payment_hardening.sql).

### `florin_packages`

Authoritative catalog: `id` (text key), `name`, `florin_amount`,
`price_php`, `currency`, `active`, `sort_order`. Authenticated users read;
no client write policies exist.

### `payment_transactions`

One row per purchase attempt:

- `id` - internal UUID; the webhook addresses transactions by this id.
- `student_id` / `school_id` - owner profile and school (FKs).
- `package_id` + `florin_amount` + `amount_php` + `currency` -
  **snapshots** taken from the package at checkout time, so later catalog
  changes never rewrite history.
- `status` - one of the five states above (CHECK constraint).
- `provider` (`'paymongo'`), `provider_session_id` (the `cs_...` checkout
  session), `provider_payment_id` (stored once the webhook sees a payment).
- `reference_number` - unique internal reference (`HC-TXN-...`) sent to
  PayMongo as both `reference_number` and Idempotency-Key; the webhook's
  trusted lookup key.
- `created_at` / `updated_at` / `completed_at`, plus `failure_reason`.

RLS: students SELECT their own rows, admins SELECT their own school's rows,
and there are **no client INSERT/UPDATE/DELETE policies** - mutations happen
only through server code using the service-role client.

A partial unique index `(student_id) WHERE status = 'pending'` (migration 069)
guarantees at most one open checkout per student.

### `processed_webhook_events`

Webhook deduplication ledger. One row per handled PayMongo event with a
`UNIQUE (provider, event_id)` constraint, so a replayed event can always be
recognized. RLS is enabled with **zero policies**: browsers have no access;
only the server's service-role client touches it.

### Florin tables (existing economy)

- `florin_balances` - one row per student holding the current integer
  balance. No client write policies since migration 022.
- `florin_transactions` - append-only ledger (`amount` positive = credit,
  negative = spend, e.g. shop purchases) written exclusively inside SECURITY
  DEFINER RPCs.

---

## 5. Security model

The layered rule of the app applies doubly here: **RLS blocks direct writes,
and money movement happens only inside guarded RPCs.**

### Why the browser cannot complete a payment

`complete_payment(p_transaction_id)` is the ONLY code that turns a paid
checkout into Florin, and it is not callable from the browser:

- It is `SECURITY DEFINER` with `SET search_path = public` (safe execution
  context), so it can move balances despite RLS - but only when invoked.
- `EXECUTE` is revoked from `PUBLIC` (Postgres grants it to PUBLIC by
  default - closed explicitly in migration 069), from `authenticated`, and
  from `anon`. It is granted **only to `service_role`**, which exists solely
  on the server (webhook handler via `SUPABASE_SERVICE_ROLE_KEY`).
- So a student clicking around in the browser - even with raw PostgREST
  calls - gets a permission error, not a credited balance.

Inside the function (migrations 068 + 069):

1. `SELECT ... FOR UPDATE` locks the transaction row (concurrent callers
   serialize).
2. Missing row -> error result; status other than `pending` ->
   `already_processed` (idempotency gate; terminal states are final).
3. Marks the row `completed` with `completed_at`.
4. Credits `florin_balances` via upsert (`ON CONFLICT (student_id)`), so a
   missing balance row can never swallow a paid credit.
5. Inserts exactly one `florin_transactions` ledger entry per completion.

Steps 3-5 run as one atomic server-side operation per successful call.

### Webhook security (`app/api/payments/webhook/route.ts`)

Processing order matters and is pinned by tests:

1. Raw request body is read (`request.text()`) before any parsing.
2. The `Paymongo-Signature` header is extracted; requests without it are
   rejected (401).
3. The signature is verified as a hex HMAC-SHA256 of the raw body keyed by
   `PAYMONGO_WEBHOOK_SECRET`, compared with `crypto.timingSafeEqual`
   (`lib/paymongo.ts`).
4. JSON parsing happens only after verification succeeds.
5. The event type must be exactly `checkout_session.payment.paid`; anything
   else is acknowledged with 200 and ignored (per PayMongo guidance, unknown
   events must never trigger retries).
6. Event-ID fast-path dedup against `processed_webhook_events`.

### Crash-safe ordering (why completion precedes recording)

An earlier design inserted the `processed_webhook_events` row *before*
calling `complete_payment()`. If the process had crashed (or the RPC errored)
after that insert, every PayMongo retry would have been answered as
"already processed" - the student pays and never receives Florin. The final
implementation flips the order:

- `complete_payment()` runs first; its failure returns HTTP 500 **without**
  recording the event, so PayMongo's retry re-runs the whole flow while the
  transaction is still safely `pending`.
- The dedup record is inserted only after completion succeeded. If recording
  then fails, the payment is already done and a retry simply lands on the
  transaction's own idempotency gate.

Duplicate deliveries racing each other are safe too: the `FOR UPDATE` lock
serializes them, and the loser observes a non-pending transaction instead of
crediting twice. The transaction row itself remains the final idempotency
authority.

### Provider data cross-checks

Before completion the webhook verifies every one of these against the
internal transaction; any mismatch stops processing **without crediting**:

| Check | Rule |
|---|---|
| Reference number | `session.attributes.reference_number` must resolve to an internal transaction |
| Checkout session ID | Must match the stored `provider_session_id` |
| Amount | `amount_php x 100` (centavos) must equal the provider payment amount |
| Currency | Must equal the transaction's `currency` (`PHP`) |
| Payment status | Must be `"paid"`; anything else marks the transaction `failed` |

---

## 6. Environment configuration

Both variables are **server-only** - never prefix them with `NEXT_PUBLIC_`,
never commit them (see `.env.example`):

```bash
# Secret API key from PayMongo Dashboard -> Developers (sk_test_... / sk_live_...)
PAYMONGO_SECRET_KEY=

# Signing secret shown when you create the webhook endpoint (whsk_...)
PAYMONGO_WEBHOOK_SECRET=
```

- **Local development:** put them in `.env.local` (gitignored).
- **Production:** set them in the Vercel project environment (same place as
  the Supabase vars - see [DEPLOYMENT.md](./DEPLOYMENT.md)).
- **Checkout redirect URLs** are built from the deployment origin via
  `siteUrlBase()` (`lib/siteUrl.ts`): set `NEXT_PUBLIC_SITE_URL` in
  production; locally the app falls back to the request origin /
  `http://localhost:3000`.

---

## 7. PayMongo sandbox E2E testing

Automated tests pin the security contracts, but they cannot prove a real
provider round-trip. This procedure verifies the complete production-like
flow: student -> application -> PayMongo Hosted Checkout -> GCash sandbox ->
webhook delivery -> signature verification -> completion -> Florin credit ->
ledger entry. Follow it once before going live, and again whenever the
webhook or checkout flow changes.

> **Status: PENDING** - nobody has run this end to end yet. Do not tick the
> boxes below until you have real test credentials.

### Prerequisites

- Local dev environment working and **all migrations applied** through 069
  (see [`database/README.md`](../database/README.md)).
- A PayMongo account with test keys enabled (Dashboard -> Developers).
- Your **test secret key** (`sk_test_xxxxxxxxx` - placeholder; use your own).
- A public HTTPS endpoint reachable by PayMongo for local testing (tunnel -
  see below).
- An authenticated **student** account in your local database.

### Public HTTPS webhook URL

PayMongo delivers webhooks from the internet, so localhost is not enough:

1. Start the app locally (`npm run dev`, port 3000).
2. Expose it through an HTTPS tunnel, e.g. with ngrok (install separately):
   `ngrok http 3000`.
3. Copy the temporary public URL it prints (e.g.
   `https://YOUR-PUBLIC-URL`).
4. Register the webhook endpoint as
   `https://YOUR-PUBLIC-URL/api/payments/webhook`.

Tunnel URLs are temporary development URLs - re-register a new one whenever
the tunnel restarts with a different address.

### Configure the webhook in PayMongo

In the PayMongo Dashboard (**Settings -> Developers -> Webhooks**):

- Endpoint URL: `https://YOUR-PUBLIC-URL/api/payments/webhook`
- Events: subscribe to **`checkout_session.payment.paid`** (this is the only
  event the implementation processes).
- Copy the signing secret PayMongo shows for this endpoint into
  `PAYMONGO_WEBHOOK_SECRET` in `.env.local`, then restart `npm run dev`.
  A mismatched secret makes every delivery fail signature verification (401).

### Run the app

```bash
npm install     # if dependencies aren't installed yet
npm run dev     # start the development server
npm test        # optional: run the automated suites first
```

### Step-by-step procedure

1. **Log in as a student** in the local app.
2. **Open the Florin shop** (`/student/shop`) or click the Florin pill in the
   header.
3. **Pick a package** in the Buy Florin modal (e.g. 50 Florin / PHP 39.00).
4. **Click the package** to start checkout.
5. **Confirm the redirect** leaves the app for the PayMongo hosted checkout
   page (`checkout.paymongo.com`).
6. **On the hosted page verify:** correct package description, correct PHP
   amount, and **GCash offered** as the payment method (it is the only
   configured method).
7. **Complete the sandbox payment with GCash** following PayMongo's official
   test-mode instructions for GCash (their dashboard/docs describe the
   current sandbox flow - do not invent test credentials or OTPs; use
   whatever their official test procedure provides).
8. **Watch the webhook arrive:** your tunnel's inspector (e.g. ngrok's web
   interface at `http://localhost:4040`) should show a `POST
   /api/payments/webhook` returning **200**, and the dev-server console logs
   the completion line.
9. **Check the transaction transitioned** `pending -> completed` (query in
   the next section).
10. **Verify exactly-once crediting:** the balance increased by precisely the
    package amount, exactly one new `florin_transactions` ledger entry
    exists, and `provider_payment_id` is populated on the transaction.
11. **Back in the app:** the success page shows "Payment Successful" only
    after the database says `completed` (while the webhook is in flight it
    shows "Verifying Payment" and auto-refreshes); the header Florin balance
    updates after refetch/remount; Payment History lists the completed
    transaction with a Completed badge.

### Database verification queries

Run in the Supabase SQL Editor (development database; replace
`REFERENCE_NUMBER` / `STUDENT_PROFILE_ID` placeholders):

```sql
-- The payment transaction (status, snapshots, provider ids)
SELECT id, status, florin_amount, amount_php, currency,
       provider_session_id, provider_payment_id, reference_number,
       created_at, completed_at, failure_reason
FROM payment_transactions
WHERE reference_number = 'REFERENCE_NUMBER';

-- The credited balance (should be old balance + florin_amount)
SELECT student_id, balance, updated_at
FROM florin_balances
WHERE student_id = 'STUDENT_PROFILE_ID';

-- The single ledger entry created by complete_payment()
SELECT id, amount, reason, created_at
FROM florin_transactions
WHERE student_id = 'STUDENT_PROFILE_ID'
ORDER BY created_at DESC
LIMIT 5;

-- The recorded webhook event (exists only AFTER completion succeeded)
SELECT provider, event_id, transaction_id, processed_at
FROM processed_webhook_events
ORDER BY processed_at DESC
LIMIT 5;
```

> **Never simulate a successful payment by editing tables manually** (e.g.
> flipping `status` to `completed` or bumping `balance` by hand). That
> bypasses the very path under test. Completion must come from the webhook
> calling `complete_payment()`.

### Negative / security tests

| Scenario | How | Expected result |
|---|---|---|
| Duplicate webhook | Replay the same delivery (PayMongo dashboard resend, or curl the captured payload again) | Second attempt answers `already_processed`; still one completed transaction, one credit, no balance change |
| Invalid signature | POST a forged/mismatched-signature body to `/api/payments/webhook` | 401 rejected; transaction untouched; no Florin credit |
| Amount mismatch | Simulate a validly-signed event whose payment amount differs from `amount_php x 100` | Processing stops ("Amount mismatch"); no credit |
| Currency mismatch | Same technique, wrong `currency` field | Processing stops ("Currency mismatch"); no credit |
| Redirect without webhook | Complete step 4, pay, but block/delay webhook delivery, then visit the success URL | Page shows "Verifying Payment" (pending), auto-refreshes, **no** Florin credited until the webhook arrives |
| Pending checkout reuse | Start checkout, abandon it, click Buy again | Same checkout URL returned (`status: "reused"`); no second session/transaction |
| Expired checkout | Let the hosted session expire (or expire it via the PayMongo dashboard), click Buy again | Old transaction marked `expired`, a fresh pending transaction + session is created, nothing credited |

For the signature/amount/currency simulations you need a valid signed payload
first: capture a real sandbox delivery from the tunnel log, then recompute
`HMAC-SHA256(rawBody, PAYMONGO_WEBHOOK_SECRET)` for tampered variants - the
algorithm matches `verifyWebhookSignature` in `lib/paymongo.ts`.

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Every delivery returns 401 | `PAYMONGO_WEBHOOK_SECRET` doesn't match the endpoint's signing secret, or `.env.local` wasn't reloaded after editing |
| No webhook arrives | Tunnel down / URL changed - re-register the endpoint; confirm the subscribed event is `checkout_session.payment.paid` |
| Checkout creation fails with "Service not configured" | `SUPABASE_SERVICE_ROLE_KEY` missing in `.env.local` (needed by server routes) |
| "Invalid or inactive package" | Packages not seeded - apply migration 067 (or check `florin_packages.active`) |
| Redirect loop back to cancel | Cancel URL built from a stale base URL - set `NEXT_PUBLIC_SITE_URL` correctly |
| Transaction stuck `pending` | Webhook never delivered or failed checks - check the tunnel log and dev-server output; the transaction stays pending rather than guessing |
| Balance didn't update in the UI | The store refetches on mount/refocus - reload the page or return from the checkout flow; the database value is authoritative |
