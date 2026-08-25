-- ===========================================================================
-- 067_payment_system.sql
-- GCash payment system via PayMongo Hosted Checkout.
--
-- Tables:
--   florin_packages          - Authoritative package catalog (server-validated)
--   payment_transactions     - Complete payment lifecycle tracking
--   processed_webhook_events - Webhook event deduplication
--
-- Security:
--   - florin_packages: Public read for authenticated users
--   - payment_transactions: Student reads own, admin reads school-scoped
--   - processed_webhook_events: No client access
--   - All mutations via SECURITY DEFINER RPCs only
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS
-- ===========================================================================

-- 1) florin_packages: Authoritative package catalog -------------------------
CREATE TABLE IF NOT EXISTS florin_packages (
  id TEXT PRIMARY KEY,                      -- '50_florin', '120_florin', etc.
  name TEXT NOT NULL,                       -- '50 Florin Pack'
  florin_amount INT NOT NULL CHECK (florin_amount > 0),
  price_php NUMERIC(10,2) NOT NULL CHECK (price_php > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) payment_transactions: Payment lifecycle --------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id),
  
  -- Package snapshot (historically accurate even if prices change)
  package_id TEXT NOT NULL REFERENCES florin_packages(id),
  florin_amount INT NOT NULL,               -- Snapshot from package at time of purchase
  amount_php NUMERIC(10,2) NOT NULL,        -- Snapshot from package at time of purchase
  currency TEXT NOT NULL DEFAULT 'PHP',
  
  -- Status lifecycle: pending → completed | failed | cancelled | expired
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired')),
  
  -- Provider tracking (PayMongo)
  provider TEXT NOT NULL DEFAULT 'paymongo',
  provider_session_id TEXT,                 -- PayMongo checkout_session ID (cs_xxx)
  provider_payment_id TEXT,                 -- PayMongo payment ID (pay_xxx)
  
  -- Reference tracking
  reference_number TEXT NOT NULL UNIQUE,    -- Internal reference (HC-TXN-xxx)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Failure tracking
  failure_reason TEXT
);

-- 3) processed_webhook_events: Event deduplication --------------------------
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'paymongo',
  event_id TEXT NOT NULL,                   -- PayMongo event ID (evt_xxx)
  transaction_id UUID REFERENCES payment_transactions(id),
  processed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (provider, event_id)              -- Prevent duplicate processing
);

-- 4) Indexes ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_transactions_student ON payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_session ON payment_transactions(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_lookup ON processed_webhook_events(provider, event_id);

-- 5) RLS Policies -----------------------------------------------------------

-- florin_packages: Public read for all authenticated users
ALTER TABLE florin_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_authenticated_read" ON florin_packages;
CREATE POLICY "packages_authenticated_read" ON florin_packages
  FOR SELECT USING (auth.role() = 'authenticated');

-- payment_transactions: Student reads own only
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_student_read" ON payment_transactions;
CREATE POLICY "payments_student_read" ON payment_transactions
  FOR SELECT USING (
    student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- payment_transactions: Admin reads school-scoped
DROP POLICY IF EXISTS "payments_admin_read" ON payment_transactions;
CREATE POLICY "payments_admin_read" ON payment_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.school_id = payment_transactions.school_id
    )
  );

-- NO INSERT/UPDATE/DELETE policies for clients
-- All mutations via SECURITY DEFINER RPCs only

-- processed_webhook_events: No client access (webhook uses service role)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no client access

-- 6) Seed florin packages ---------------------------------------------------
INSERT INTO florin_packages (id, name, florin_amount, price_php, sort_order)
VALUES
  ('50_florin', '50 Florin Pack', 50, 39.00, 10),
  ('120_florin', '120 Florin Pack', 120, 79.00, 20),
  ('300_florin', '300 Florin Pack', 300, 179.00, 30),
  ('650_florin', '650 Florin Pack', 650, 349.00, 40)
ON CONFLICT (id) DO NOTHING;
