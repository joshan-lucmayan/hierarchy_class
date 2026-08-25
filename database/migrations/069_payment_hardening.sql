-- ===========================================================================
-- 069_payment_hardening.sql
-- Hardening pass for the GCash/PayMongo payment system (067 + 068).
--
-- 1) complete_payment: REVOKE EXECUTE FROM PUBLIC.
--    PostgreSQL grants EXECUTE on new functions to PUBLIC by default; 068 only
--    revoked from authenticated/anon. This closes the PUBLIC grant path so the
--    function is callable by service_role (and the DB owner) ONLY.
--
-- 2) complete_payment: guarantee a florin_balances row exists before crediting.
--    The old UPDATE silently affected zero rows if the student had no balance
--    row yet, inserting a ledger entry while crediting nothing. Upsert makes
--    the credit unconditional and returns the real post-credit balance.
--
-- 3) Enforce at most ONE pending payment transaction per student. Two
--    concurrent create-checkout requests could otherwise both pass the app's
--    pending-check and mint two PayMongo sessions (double charge risk). The
--    partial unique index turns the race into an insert conflict, which the
--    checkout route now handles by reusing the winning session.
--
-- Idempotent: DROP INDEX IF EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, idempotent REVOKE/GRANT.
-- ===========================================================================

-- 1+2) Hardened complete_payment --------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_payment(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx payment_transactions%ROWTYPE;
  v_balance INT;
BEGIN
  -- 1. Lock the row for atomic update (prevents concurrent processing)
  SELECT * INTO v_tx FROM payment_transactions
  WHERE id = p_transaction_id FOR UPDATE;

  -- 2. Verify transaction exists
  IF v_tx IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'transaction_not_found',
      'transaction_id', p_transaction_id
    );
  END IF;

  -- 3. Idempotency check: Only process 'pending' transactions
  --    A completed/failed/cancelled/expired transaction must never be processed again
  IF v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'already_processed',
      'status', v_tx.status,
      'transaction_id', p_transaction_id
    );
  END IF;

  -- 4. Mark transaction as completed
  UPDATE payment_transactions
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_transaction_id;

  -- 5. Credit Florin balance atomically. The upsert guarantees the balance
  --    row exists even if profile-trigger initialization was skipped, so the
  --    ledger entry below can never describe a credit that never landed.
  INSERT INTO florin_balances (student_id, balance)
  VALUES (v_tx.student_id, v_tx.florin_amount)
  ON CONFLICT (student_id)
  DO UPDATE SET balance = florin_balances.balance + v_tx.florin_amount,
                updated_at = now()
  RETURNING balance INTO v_balance;

  -- 6. Insert Florin ledger transaction
  INSERT INTO florin_transactions (school_id, student_id, amount, reason)
  VALUES (
    v_tx.school_id,
    v_tx.student_id,
    v_tx.florin_amount,
    'GCash purchase: ' || v_tx.florin_amount || ' Florin (Package: ' || v_tx.package_id || ')'
  );

  -- 7. Return success with updated balance
  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', p_transaction_id,
    'florin_added', v_tx.florin_amount,
    'balance', v_balance
  );
END;
$$;

-- PUBLIC has EXECUTE on functions by default in PostgreSQL. Revoke it so the
-- only granted path is service_role (plus direct owner/admin access).
REVOKE EXECUTE ON FUNCTION public.complete_payment(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_payment(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_payment(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_payment(UUID) TO service_role;

-- 3) At most one pending transaction per student -----------------------------
-- The checkout route resolves conflicts by fetching the winner's pending
-- transaction and reusing its PayMongo session instead of erroring out.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_one_pending_per_student
  ON payment_transactions (student_id)
  WHERE status = 'pending';
