-- ===========================================================================
-- 068_complete_payment_rpc.sql
-- Restricted RPC for completing payment transactions and crediting Florin.
--
-- Security model:
--   - SECURITY DEFINER: Runs with function owner privileges (superuser)
--   - REVOKE from authenticated: Normal browser clients CANNOT call this
--   - GRANT to service_role: Only server-side webhook handler can invoke
--   - Row locking prevents concurrent processing
--   - Idempotency: Only processes 'pending' transactions
--
-- This is the ONLY path that may credit Florin for payments.
-- ===========================================================================

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
  
  -- 5. Credit Florin balance atomically
  UPDATE florin_balances
  SET balance = balance + v_tx.florin_amount, 
      updated_at = now()
  WHERE student_id = v_tx.student_id
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

-- ===========================================================================
-- PERMISSION RESTRICTIONS
-- ===========================================================================

-- Revoke EXECUTE from authenticated role (normal browser clients)
-- This prevents any student/teacher/admin from calling this RPC via the client
REVOKE EXECUTE ON FUNCTION public.complete_payment(UUID) FROM authenticated;

-- Grant EXECUTE only to service_role (used by webhook server)
-- The webhook handler uses SUPABASE_SERVICE_ROLE_KEY which has service_role permissions
GRANT EXECUTE ON FUNCTION public.complete_payment(UUID) TO service_role;

-- Also revoke from anon (unauthenticated requests)
REVOKE EXECUTE ON FUNCTION public.complete_payment(UUID) FROM anon;
